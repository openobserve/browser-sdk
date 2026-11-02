import { noop } from '@openobserve/js-core/util'
import type { ProfilerApi } from '@openobserve/browser-rum-core'

export const noopProfilerApi: ProfilerApi = {
  stop: noop,
  onRumStart: noop,
}
