import type { RelativeTime } from '@openobserve/js-core/time'
import type { TelemetryEvent } from '@openobserve/browser-core'
import { createHook } from '@openobserve/js-core/assembly'
import type { Hook } from '@openobserve/js-core/assembly'
import type { RecursivePartial } from '@openobserve/js-core/util'
import type { LogsEvent } from '../logsEvent.types'
import type { RawLogsEvent } from '../rawLogsEvent.types'
import type { LogsEventDomainContext } from '../domainContext.types'

export type DefaultLogsEventAttributes = RecursivePartial<LogsEvent>
export type DefaultTelemetryEventAttributes = RecursivePartial<TelemetryEvent>

type DeepReadonly<T> = {
  readonly [K in keyof T]: DeepReadonly<T[K]>
}

// Use readonly and DeepReadonly to prevent assemble hook callbacks from mutating the inputs.
// DeepReadonly is only applied to objects rather than the entire AssembleHookParams to avoid casts for primitives.
export interface AssembleHookParams {
  readonly startTime: RelativeTime
  rawLogsEvent: DeepReadonly<RawLogsEvent>
  domainContext: DeepReadonly<LogsEventDomainContext>
}

export type AssembleHook = Hook<AssembleHookParams, DefaultLogsEventAttributes>
export type AssembleTelemetryHook = Hook<{ startTime: RelativeTime }, DefaultTelemetryEventAttributes>

export interface Hooks {
  assembleEventDefaults: AssembleHook
  assembleTelemetry: AssembleTelemetryHook
  assembleEvent: AssembleHook
}

export function createHooks(): Hooks {
  return {
    assembleEventDefaults: createHook(),
    assembleTelemetry: createHook(),
    assembleEvent: createHook(),
  }
}
