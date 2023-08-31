import type { RecorderApi } from '@openobserve/browser-rum-core'
import type { RelativeTime } from '@openobserve/browser-core'
import { Observable, noop } from '@openobserve/browser-core'

export const noopRecorderApi: RecorderApi = {
  start: noop,
  stop: noop,
  isRecording: () => false,
  onRumStart: noop,
  getReplayStats: () => undefined,
  getSessionReplayLink: () => undefined,
  recorderStartObservable: new Observable<RelativeTime>(),
  getSerializedNodeId: () => undefined,
}
