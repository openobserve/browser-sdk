import type {
  DISCARDED,
  HookNamesAsConst,
  RecursivePartial,
  RelativeTime,
  SKIPPED,
  TelemetryEvent,
} from '@openobserve/browser-core'
import { abstractHooks } from '@openobserve/browser-core'
import type { LogsEvent } from '../logsEvent.types'

export type DefaultLogsEventAttributes = RecursivePartial<LogsEvent>
export type DefaultTelemetryEventAttributes = RecursivePartial<TelemetryEvent>

export interface HookCallbackMap {
  [HookNamesAsConst.ASSEMBLE]: (param: { startTime: RelativeTime }) => DefaultLogsEventAttributes | SKIPPED | DISCARDED
  [HookNamesAsConst.ASSEMBLE_TELEMETRY]: (param: {
    startTime: RelativeTime
  }) => DefaultTelemetryEventAttributes | SKIPPED | DISCARDED
}

export type Hooks = ReturnType<typeof createHooks>

export const createHooks = abstractHooks<HookCallbackMap>
