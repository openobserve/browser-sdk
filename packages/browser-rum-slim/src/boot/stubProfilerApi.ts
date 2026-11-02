import { noop } from '@openobserve/js-core/util'
import type { ProfilerApi } from '@openobserve/browser-rum-core'

export function makeProfilerApiStub(): ProfilerApi {
  return {
    onRumStart: noop,
    stop: noop,
  }
}
