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
  toPaddedSpanIdHex,
  toPaddedTraceIdHex,
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
 * Clears the tracing ids of requests that ended with status 0 without being aborted, unless trace
 * headers were actually injected: the backend may have received the request and recorded a span
 * with the real status, so the ids stay the link to it. Without injected headers nothing links
 * them to a backend span, so they are cleared.
 *
 * "Injected" means a trace header was written to the request and not dropped by the browser:
 * headers written to a fetch in `no-cors` mode do not count, since browsers silently drop
 * non-safelisted headers (traceparent, x-*) for such requests. It does not prove the request
 * reached the server: a failed CORS preflight also ends in status 0, so a kept id may point at a
 * trace with no server span, and consumers must handle that.
 * */
export function clearTracingIfNeeded(context: RumFetchResolveContext | RumXhrCompleteContext) {
  if (context.status === 0 && !context.isAborted && !context.traceHeadersInjected) {
    context.traceId = undefined
    context.spanId = undefined
    context.traceSampled = undefined
  }
}

// A baggage header alone does not link the request to a trace, so it does not count.
function isTraceHeaderName(name: string) {
  return name.toLowerCase() !== 'baggage'
}

function hasTraceHeaders(tracingHeaders: TracingHeaders) {
  return Object.keys(tracingHeaders).some(isTraceHeaderName)
}

// Browsers drop non-safelisted headers of `no-cors` requests, so none of ours reaches the wire.
function isNoCorsFetch(context: Partial<RumFetchStartContext>) {
  const mode = context.init?.mode ?? (context.input instanceof Request ? context.input.mode : undefined)
  return mode === 'no-cors'
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
            const request = new Request(context.input)
            context.input = request
            Object.keys(tracingHeaders).forEach((key) => {
              // OpenObserve: use set instead of append to replace existing tracing headers
              request.headers.set(key, tracingHeaders[key])
            })
            // The headers of a no-cors Request are guarded: set() is silently ignored. Check what stuck.
            context.traceHeadersInjected =
              !isNoCorsFetch(context) &&
              Object.keys(tracingHeaders).some((key) => isTraceHeaderName(key) && request.headers.has(key))
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
            context.traceHeadersInjected = !isNoCorsFetch(context) && hasTraceHeaders(tracingHeaders)
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
            context.traceHeadersInjected = hasTraceHeaders(tracingHeaders)
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

  // The ids come from a traceparent the application put on the request: that header is on the
  // wire whatever the propagators are (unless the browser drops it, in a no-cors fetch).
  if (existingTraceparent?.onWire && !isNoCorsFetch(context)) {
    context.traceHeadersInjected = true
  }
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
): { traceId: TraceIdentifier; spanId: SpanIdentifier; sampled: boolean; onWire: boolean } | null {
  let traceparentValue: string | null = null
  // False when the value comes from a Request whose headers fetch ignores because init.headers is set.
  let onWire = true

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
    onWire = !fetchContext.init?.headers
  }

  if (!traceparentValue) {
    return null
  }

  for (const value of traceparentValue.split(',')) {
    const parsed = parseTraceparent(value)
    if (parsed) {
      return { ...parsed, onWire }
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
        // The backend (get_or_create_trace_id) reads `x-openobserve-trace-id` and
        // `x-openobserve-span-id` and validates 32/16 hex chars — decimal values or the
        // upstream `-parent-id` name are silently ignored (masked by the traceparent
        // fallback).
        Object.assign(tracingHeaders, {
          'x-openobserve-origin': 'rum',
          'x-openobserve-span-id': toPaddedSpanIdHex(spanId),
          'x-openobserve-sampling-priority': traceSampled ? '1' : '0',
          'x-openobserve-trace-id': toPaddedTraceIdHex(traceId),
        })
        break
      }
      // https://www.w3.org/TR/trace-context/
      case 'tracecontext': {
        Object.assign(tracingHeaders, {
          traceparent: `00-${toPaddedTraceIdHex(traceId)}-${toPaddedSpanIdHex(spanId)}-0${
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
