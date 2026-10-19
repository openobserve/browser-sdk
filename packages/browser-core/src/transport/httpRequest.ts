import type { EndpointBuilder } from '../domain/configuration'
import type { Context } from '../tools/serialisation/context'
import { fetch } from '../browser/fetch'
import { monitor, monitorError } from '../tools/monitor'
import type { RawError } from '../domain/error/error.types'
import { Observable } from '../tools/observable'
import { ONE_KIBI_BYTE } from '../tools/utils/byteUtils'
import { newRetryState, sendWithRetryStrategy } from './sendWithRetryStrategy'

/**
 * beacon payload max queue size implementation is 64kb
 * ensure that we leave room for logs, rum and potential other users
 */
export const RECOMMENDED_REQUEST_BYTES_LIMIT = 16 * ONE_KIBI_BYTE

/**
 * Use POST request without content type to:
 * - avoid CORS preflight requests
 * - allow usage of sendBeacon
 *
 * multiple elements are sent separated by \n in order
 * to be parsed correctly without content type header
 */

export interface HttpRequest<Body extends Payload = Payload> {
  observable: Observable<HttpRequestEvent<Body>>
  send(this: void, payload: Body): void
  sendOnExit(this: void, payload: Body): void
}

export interface HttpResponse extends Context {
  status: number
  type?: ResponseType
}

export interface BandwidthStats {
  ongoingByteCount: number
  ongoingRequestCount: number
}

export type HttpRequestEvent<Body extends Payload = Payload> =
  | {
      // A request to send the given payload failed. (We may retry.)
      type: 'failure'
      bandwidth: BandwidthStats
      payload: Body
    }
  | {
      // The given payload was discarded because the request queue is full.
      type: 'queue-full'
      bandwidth: BandwidthStats
      payload: Body
    }
  | {
      // A request to send the given payload succeeded.
      type: 'success'
      bandwidth: BandwidthStats
      payload: Body
    }

export interface Payload {
  data: string | FormData | Blob
  bytesCount: number
  retry?: RetryInfo
  encoding?: 'deflate'
}

export interface RetryInfo {
  count: number
  lastFailureStatus: number
}

// The intake authenticates requests with the client token carried in the URL: cookies are never
// needed. Omit credentials so that, for example, a same-origin proxy does not receive the cookies
// of the host application.
const FETCH_OPTIONS: RequestInit = { method: 'POST', mode: 'cors', credentials: 'omit' }

export function createHttpRequest<Body extends Payload = Payload>(
  endpointBuilders: EndpointBuilder[],
  reportError: (error: RawError) => void,
  bytesLimit: number = RECOMMENDED_REQUEST_BYTES_LIMIT
): HttpRequest<Body> {
  const observable = new Observable<HttpRequestEvent<Body>>()
  const retryState = newRetryState<Body>()

  return {
    observable,
    send: (payload: Body) => {
      for (const endpointBuilder of endpointBuilders) {
        sendWithRetryStrategy(
          payload,
          retryState,
          (payload, onResponse) => {
            fetchStrategy(endpointBuilder, payload, onResponse)
          },
          endpointBuilder.trackType,
          reportError,
          observable
        )
      }
    },
    /**
     * On page exit, prefer a keepalive fetch (which lets us omit credentials) and fall back to
     * sendBeacon when keepalive is not supported (sendBeacon always sends cookies).
     */
    sendOnExit: (payload: Body) => {
      for (const endpointBuilder of endpointBuilders) {
        sendOnExitStrategy(endpointBuilder, bytesLimit, payload)
      }
    },
  }
}

/**
 * Whether `fetch` supports the `keepalive` option, which lets a request outlive the page. Some
 * browsers ignore unknown `RequestInit` members, so check for the property on a Request instance.
 */
function isFetchKeepAliveSupported() {
  try {
    return typeof Request === 'function' && 'keepalive' in new Request('http://a')
  } catch {
    return false
  }
}

function sendOnExitStrategy(endpointBuilder: EndpointBuilder, bytesLimit: number, payload: Payload) {
  const canSendOnExit = payload.bytesCount < bytesLimit
  if (canSendOnExit) {
    try {
      // The `beacon` api type is kept for both transports so the intake keeps reporting on-exit
      // requests the same way.
      const beaconUrl = endpointBuilder.build('beacon', payload)

      if (isFetchKeepAliveSupported()) {
        // Unlike sendBeacon, which always sends cookies, a keepalive fetch can omit credentials.
        // The 64 KiB keepalive quota is shared by all in-flight keepalive requests, hence the
        // bytes limit above. A request that is not queued rejects: fall back to a regular fetch.
        fetch(beaconUrl, { ...FETCH_OPTIONS, body: payload.data, keepalive: true }).catch(
          monitor(() => fetchStrategy(endpointBuilder, payload))
        )
        return
      }

      const isQueued = navigator.sendBeacon(beaconUrl, payload.data)

      if (isQueued) {
        return
      }
    } catch (e) {
      reportBeaconError(e)
    }
  }

  fetchStrategy(endpointBuilder, payload)
}

let hasReportedBeaconError = false

function reportBeaconError(e: unknown) {
  if (!hasReportedBeaconError) {
    hasReportedBeaconError = true
    monitorError(e)
  }
}

export function fetchStrategy(
  endpointBuilder: EndpointBuilder,
  payload: Payload,
  onResponse?: (r: HttpResponse) => void
) {
  const fetchUrl = endpointBuilder.build('fetch', payload)

  fetch(fetchUrl, { ...FETCH_OPTIONS, body: payload.data })
    .then(monitor((response: Response) => onResponse?.({ status: response.status, type: response.type })))
    .catch(monitor(() => onResponse?.({ status: 0 })))
}
