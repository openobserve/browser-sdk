import type { MatchOption } from '@openobserve/browser-core'

/**
 * openobserve: OpenObserve (x-openobserve-*), alias of datadog
 * datadog: Datadog (x-openobserve-*)
 * tracecontext: W3C Trace Context (traceparent, tracestate)
 * b3: B3 Single Header (b3)
 * b3multi: B3 Multiple Headers (X-B3-*)
 */
export type PropagatorType = 'datadog' | 'openobserve' | 'b3' | 'b3multi' | 'tracecontext'
export interface TracingOption {
  match: MatchOption
  propagatorTypes: PropagatorType[]
}
