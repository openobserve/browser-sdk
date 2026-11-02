import { noop } from '@openobserve/js-core/util'
import type { RecorderApi } from '@openobserve/browser-rum-core'

export const noopRecorderApi: RecorderApi = {
  start: noop,
  stop: noop,
  isRecording: () => false,
  onRumStart: noop,
  getReplayStats: () => undefined,
  getSessionReplayLink: () => undefined,
}
