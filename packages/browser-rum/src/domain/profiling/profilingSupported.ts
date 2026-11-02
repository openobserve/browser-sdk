import { globalObject } from '@openobserve/js-core/util'
export function isProfilingSupported(): boolean {
  // This API might be unavailable in some browsers
  return globalObject.Profiler !== undefined
}
