import type { ContextManager, SessionManager } from '@openobserve/browser-core'
import {
  objectEntries,
  shallowClone,
  matchList,
  TraceContextInjection,
  correctedChildSampleRate,
  isSampled,
  canUseEventBridge,
  getEventBridge,
} from '@openobserve/browser-core'
import type { RumConfiguration } from '../configuration'
import type {
  RumFetchResolveContext,
  RumFetchStartContext,
  RumXhrCompleteContext,
  RumXhrStartContext,
} from '../requestCollection'
import type { PropagatorType } from './tracer.types'
import type { SpanIdentifier, TraceIdentifier } from './identifier'
import {
  createSpanIdentifier,
  createSpanIdentifierFromHex,
  createTraceIdentifier,
  createTraceIdentifierFromHex,
  toPaddedHexadecimalString,
} from './identifier'

export interface Tracer {
  traceFetch: (context: Partial<RumFetchStartContext>) => void
  traceXhr: (context: Partial<RumXhrStartContext>, xhr: XMLHttpRequest) => void
  clearTracingIfNeeded: (context: RumFetchResolveContext | RumXhrCompleteContext) => void
}

interface TracingHeaders {
  [key: string]: string
}

/**
 * Clear tracing information to avoid incomplete traces. Ideally, we should do it when the
 * request did not reach the server, but the browser does not expose this. So, we clear tracing
 * information if the request ended with status 0 without being aborted by the application.
 *
 * Reasoning:
 *
 * * Applications are usually aborting requests after a bit of time, for example when the user is
 * typing (autocompletion) or navigating away (in a SPA). With a performant device and good
 * network conditions, the request is likely to reach the server before being canceled.
 *
 * * Requests aborted otherwise (ex: lack of internet, CORS issue, blocked by a privacy extension)
 * are likely to finish quickly and without reaching the server.
 *
 * Of course, it might not be the case every time, but it should limit having incomplete traces a
 * bit.
 * */
export function clearTracingIfNeeded(context: RumFetchResolveContext | RumXhrCompleteContext) {
  if (context.status === 0 && !context.isAborted) {
    context.traceId = undefined
    context.spanId = undefined
    context.traceSampled = undefined
  }
}

export function startTracer(
  configuration: RumConfiguration,
  sessionManager: SessionManager,
  userContext: ContextManager,
  accountContext: ContextManager
): Tracer {
  return {
    clearTracingIfNeeded,
    traceFetch: (context) =>
      injectHeadersIfTracingAllowed(
        configuration,
        context,
        sessionManager,
        userContext,
        accountContext,
        (tracingHeaders: TracingHeaders) => {
          if (context.input instanceof Request && !context.init?.headers) {
            context.input = new Request(context.input)
            Object.keys(tracingHeaders).forEach((key) => {
              // OpenObserve: use set instead of append to replace existing tracing headers
              ;(context.input as Request).headers.set(key, tracingHeaders[key])
            })
          } else {
            context.init = shallowClone(context.init)
            const headers: Array<[string, string]> = []
            // OpenObserve: skip existing tracing headers so the injected ones replace them
            const tracingHeaderKeys = Object.keys(tracingHeaders).map((key) => key.toLowerCase())
            if (context.init.headers instanceof Headers) {
              context.init.headers.forEach((value, key) => {
                if (!tracingHeaderKeys.includes(key.toLowerCase())) {
                  headers.push([key, value])
                }
              })
            } else if (Array.isArray(context.init.headers)) {
              context.init.headers.forEach((header) => {
                if (!tracingHeaderKeys.includes(header[0].toLowerCase())) {
                  headers.push(header)
                }
              })
            } else if (context.init.headers) {
              Object.keys(context.init.headers).forEach((key) => {
                if (!tracingHeaderKeys.includes(key.toLowerCase())) {
                  headers.push([key, (context.init!.headers as Record<string, string>)[key]])
                }
              })
            }
            context.init.headers = headers.concat(objectEntries(tracingHeaders))
          }
        }
      ),
    traceXhr: (context, xhr) =>
      injectHeadersIfTracingAllowed(
        configuration,
        context,
        sessionManager,
        userContext,
        accountContext,
        (tracingHeaders: TracingHeaders) => {
          try {
            Object.keys(tracingHeaders).forEach((name) => {
              xhr.setRequestHeader(name, tracingHeaders[name])
            })
          } catch {
            // XHR may have already been sent (buffered replay via microtask)
          }
        }
      ),
  }
}

function injectHeadersIfTracingAllowed(
  configuration: RumConfiguration,
  context: Partial<RumFetchStartContext | RumXhrStartContext>,
  sessionManager: SessionManager,
  userContext: ContextManager,
  accountContext: ContextManager,
  inject: (tracingHeaders: TracingHeaders) => void
) {
  const session = sessionManager.findTrackedSession()
  if (!session) {
    return
  }

  const tracingOption = configuration.allowedTracingUrls.find((tracingOption) =>
    matchList([tracingOption.match], context.url!, true)
  )
  if (!tracingOption) {
    return
  }

  const fallbackTraceSampled = isSampled(
    session.id,
    correctedChildSampleRate(configuration.sessionSampleRate, configuration.traceSampleRate)
  )
  const traceSampled = canUseEventBridge()
    ? (getEventBridge()?.getIsTraceSampled() ?? fallbackTraceSampled)
    : fallbackTraceSampled

  const shouldInjectHeaders = traceSampled || configuration.traceContextInjection === TraceContextInjection.ALL
  if (!shouldInjectHeaders) {
    return
  }

  // OpenObserve: if the request already carries a valid W3C traceparent (e.g. set by an
  // instrumented app), continue that trace instead of starting a new one.
  const existingTraceparent = extractExistingTraceparent(context)
  if (existingTraceparent) {
    context.traceSampled = existingTraceparent.sampled
    context.traceId = existingTraceparent.traceId
    context.spanId = existingTraceparent.spanId
  } else {
    context.traceSampled = traceSampled
    context.traceId = createTraceIdentifier()
    context.spanId = createSpanIdentifier()
  }

  inject(
    makeTracingHeaders(
      context.traceId!,
      context.spanId!,
      context.traceSampled!,
      session.id,
      tracingOption.propagatorTypes,
      userContext,
      accountContext,
      configuration
    )
  )
}

/**
 * Parses a W3C Trace Context traceparent header value.
 *
 * Format: {version}-{trace-id}-{parent-id}-{flags}
 * Example: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
 *
 * See https://www.w3.org/TR/trace-context/#traceparent-header
 */
function parseTraceparent(
  traceparentValue: string
): { traceId: TraceIdentifier; spanId: SpanIdentifier; sampled: boolean } | null {
  const parts = traceparentValue.trim().split('-')
  if (parts.length !== 4) {
    return null
  }
  const [version, traceIdHex, parentIdHex, flags] = parts
  if (version !== '00') {
    return null
  }
  if (!/^[0-9a-f]{32}$/i.test(traceIdHex) || traceIdHex === '00000000000000000000000000000000') {
    return null
  }
  if (!/^[0-9a-f]{16}$/i.test(parentIdHex) || parentIdHex === '0000000000000000') {
    return null
  }
  if (!/^[0-9a-f]{2}$/i.test(flags)) {
    return null
  }
  // eslint-disable-next-line no-bitwise
  const sampled = (parseInt(flags, 16) & 1) === 1
  return {
    traceId: createTraceIdentifierFromHex(traceIdHex.toLowerCase()),
    spanId: createSpanIdentifierFromHex(parentIdHex.toLowerCase()),
    sampled,
  }
}

/**
 * Extracts and validates an existing traceparent header from the request context (fetch init
 * headers in all their forms, or a Request object). When the header appears multiple times,
 * the first valid value wins, per the W3C spec.
 */
function extractExistingTraceparent(
  context: Partial<RumFetchStartContext | RumXhrStartContext>
): { traceId: TraceIdentifier; spanId: SpanIdentifier; sampled: boolean } | null {
  let traceparentValue: string | null = null

  const fetchContext = context as Partial<RumFetchStartContext>
  if (fetchContext.init?.headers) {
    if (fetchContext.init.headers instanceof Headers) {
      traceparentValue = fetchContext.init.headers.get('traceparent')
    } else if (Array.isArray(fetchContext.init.headers)) {
      const traceparentHeader = fetchContext.init.headers.find(
        ([key]: [string, string]) => key.toLowerCase() === 'traceparent'
      )
      traceparentValue = traceparentHeader?.[1] || null
    } else if (typeof fetchContext.init.headers === 'object') {
      const headers = fetchContext.init.headers as Record<string, string>
      traceparentValue = headers['traceparent'] || headers['Traceparent'] || null
    }
  }

  if (!traceparentValue && fetchContext.input instanceof Request) {
    traceparentValue = fetchContext.input.headers.get('traceparent')
  }

  if (!traceparentValue) {
    return null
  }

  for (const value of traceparentValue.split(',')) {
    const parsed = parseTraceparent(value)
    if (parsed) {
      return parsed
    }
  }
  return null
}

/**
 * When trace is not sampled, set priority to '0' instead of not adding the tracing headers
 * to prepare the implementation for sampling delegation.
 */
function makeTracingHeaders(
  traceId: TraceIdentifier,
  spanId: SpanIdentifier,
  traceSampled: boolean,
  sessionId: string,
  propagatorTypes: PropagatorType[],
  userContext: ContextManager,
  accountContext: ContextManager,
  configuration: RumConfiguration
): TracingHeaders {
  const tracingHeaders: TracingHeaders = {}

  propagatorTypes.forEach((propagatorType) => {
    switch (propagatorType) {
      case 'datadog':
      case 'openobserve': {
        Object.assign(tracingHeaders, {
          'x-openobserve-origin': 'rum',
          'x-openobserve-parent-id': spanId.toString(),
          'x-openobserve-sampling-priority': traceSampled ? '1' : '0',
          'x-openobserve-trace-id': traceId.toString(),
        })
        break
      }
      // https://www.w3.org/TR/trace-context/
      case 'tracecontext': {
        Object.assign(tracingHeaders, {
          traceparent: `00-${traceId.toString(16).padStart(32, '0')}-${toPaddedHexadecimalString(spanId)}-0${
            traceSampled ? '1' : '0'
          }`,
          tracestate: `dd=s:${traceSampled ? '1' : '0'};o:rum`,
        })
        break
      }
      // https://github.com/openzipkin/b3-propagation
      case 'b3': {
        Object.assign(tracingHeaders, {
          b3: `${toPaddedHexadecimalString(traceId)}-${toPaddedHexadecimalString(spanId)}-${traceSampled ? '1' : '0'}`,
        })
        break
      }
      case 'b3multi': {
        Object.assign(tracingHeaders, {
          'X-B3-TraceId': toPaddedHexadecimalString(traceId),
          'X-B3-SpanId': toPaddedHexadecimalString(spanId),
          'X-B3-Sampled': traceSampled ? '1' : '0',
        })
        break
      }
    }
  })

  if (configuration.propagateTraceBaggage) {
    const baggageItems: Record<string, string> = {
      'session.id': sessionId,
    }

    const userId = userContext.getContext().id
    if (typeof userId === 'string') {
      baggageItems['user.id'] = userId
    }

    const accountId = accountContext.getContext().id
    if (typeof accountId === 'string') {
      baggageItems['account.id'] = accountId
    }

    const baggageHeader = Object.entries(baggageItems)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join(',')
    if (baggageHeader) {
      tracingHeaders['baggage'] = baggageHeader
    }
  }

  return tracingHeaders
}
