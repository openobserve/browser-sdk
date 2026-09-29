import { noop } from '@openobserve/browser-core'
import type { RumConfiguration, StartRecordingOptions } from '@openobserve/browser-rum-core'
import type { Strategy } from './postStartStrategy'

const enum PreStartRecorderStatus {
  None,
  HadManualStart,
  HadManualStop,
}

export function createPreStartStrategy(): {
  strategy: Strategy
  shouldStartImmediately: (configuration: RumConfiguration) => boolean
  getStartOptions: () => StartRecordingOptions | undefined
} {
  let status = PreStartRecorderStatus.None
  let startOptions: StartRecordingOptions | undefined
  return {
    strategy: {
      start(options?: StartRecordingOptions) {
        status = PreStartRecorderStatus.HadManualStart
        if (options?.force) {
          startOptions = options
        }
      },
      stop() {
        status = PreStartRecorderStatus.HadManualStop
        startOptions = undefined
      },
      isRecording: () => false,
      getSessionReplayLink: noop as () => string | undefined,
    },
    shouldStartImmediately(configuration) {
      return (
        status === PreStartRecorderStatus.HadManualStart ||
        (status === PreStartRecorderStatus.None && !configuration.startSessionReplayRecordingManually)
      )
    },
    getStartOptions: () => (status === PreStartRecorderStatus.HadManualStart ? startOptions : undefined),
  }
}
