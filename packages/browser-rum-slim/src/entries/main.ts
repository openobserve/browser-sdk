// Keep the following in sync with packages/browser-rum/src/entries/main.ts
import { globalObject } from '@openobserve/js-core/util'
import { defineGlobal } from '@openobserve/browser-core'
import type { RumPublicApi } from '@openobserve/browser-rum-core'
import { makeRumPublicApi } from '@openobserve/browser-rum-core'
import { makeRecorderApiStub } from '../boot/stubRecorderApi'
import { makeProfilerApiStub } from '../boot/stubProfilerApi'

export type {
  User,
  Account,
  TraceContextInjection,
  SessionPersistence,
  TrackingConsent,
  MatchOption,
  RumInternalContext,
} from '@openobserve/browser-core'
export type { Context, ContextValue, ContextArray } from '@openobserve/js-core/util'
export type { ProxyFn, Site } from '@openobserve/js-core/transport'

/**
 * @deprecated Use {@link DatadogRum} instead
 */
export type RumGlobal = RumPublicApi

export type {
  RumPublicApi as DatadogRum,
  RumInitConfiguration,
  RumBeforeSend,
  ViewOptions,
  StartRecordingOptions,
  AddDurationVitalOptions,
  DurationVitalOptions,
  OperationOptions,
  FeatureOperationOptions,
  FailureReason,
  ActionOptions,
  ResourceOptions,
  ResourceStopOptions,
  TracingOption,
  RumPlugin,
  OnRumStartOptions,
  RumPluginOnInitOptions,
  PropagatorType,
  FeatureFlagsForEvents,
  MatchHeader,

  // Events
  CommonProperties,
  RumEvent,
  RumActionEvent,
  RumErrorEvent,
  RumLongTaskEvent,
  RumResourceEvent,
  RumViewEvent,
  RumVitalEvent,

  // Events context
  RumEventDomainContext,
  RumViewEventDomainContext,
  RumErrorEventDomainContext,
  RumActionEventDomainContext,
  RumVitalEventDomainContext,
  RumWebSocketVitalEventDomainContext,
  RumResourceEventDomainContext,
  RumWebSocketResourceEventDomainContext,
  RumLongTaskEventDomainContext,
} from '@openobserve/browser-rum-core'
export { DEFAULT_TRACKED_RESOURCE_HEADERS, CanvasRecordingQuality } from '@openobserve/browser-rum-core'
export { DefaultPrivacyLevel } from '@openobserve/browser-core'

/**
 * The global RUM instance. Use this to call RUM methods.
 *
 * @category Main
 * @see {@link DatadogRum}
 * @see [RUM Browser Monitoring Setup](https://docs.datadoghq.com/real_user_monitoring/browser/)
 */
export const openobserveRum = makeRumPublicApi(makeRecorderApiStub(), makeProfilerApiStub(), {
  sdkName: 'rum-slim',
})

interface BrowserWindow {
  O2_RUM?: RumPublicApi
}
defineGlobal(globalObject as BrowserWindow, 'O2_RUM', openobserveRum)
