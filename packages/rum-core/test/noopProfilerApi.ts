import type { ProfilerApi } from '@openobserve/browser-rum-core'
import { noop } from '@openobserve/browser-core'

export const noopProfilerApi: ProfilerApi = {
  stop: noop,
  onRumStart: noop,
}
