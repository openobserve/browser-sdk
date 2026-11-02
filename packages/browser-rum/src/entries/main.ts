/**
 * Datadog Browser RUM SDK - Full version with Session Replay and Real User Profiling capabilities.
 * Use this package to monitor your web application's performance and user experience.
 *
 * @packageDocumentation
 * @see [RUM Browser Monitoring Setup](https://docs.datadoghq.com/real_user_monitoring/browser/)
 */

import { globalObject } from '@openobserve/js-core/util'
// Keep the following in sync with packages/browser-rum-slim/src/entries/main.ts
import { defineGlobal } from '@openobserve/browser-core'
import type { RumPublicApi } from '@openobserve/browser-rum-core'
import { makeRumPublicApi } from '@openobserve/browser-rum-core'
import { makeRecorderApi } from '../boot/recorderApi'
import { createDeflateEncoder, startDeflateWorker } from '../domain/deflate'
import { makeProfilerApi } from '../boot/profilerApi'

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
export { DefaultPrivacyLevel } from '@openobserve/browser-core'
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
  RumViewUpdateEvent,
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

const recorderApi = makeRecorderApi()

const profilerApi = makeProfilerApi()

/**
 * The global RUM instance. Use this to call RUM methods.
 *
 * @category Main
 * @see {@link DatadogRum}
 * @see [RUM Browser Monitoring Setup](https://docs.datadoghq.com/real_user_monitoring/browser/)
 */
export const openobserveRum = makeRumPublicApi(recorderApi, profilerApi, {
  startDeflateWorker,
  createDeflateEncoder,
  sdkName: 'rum',
})

interface BrowserWindow {
  O2_RUM?: RumPublicApi
}
defineGlobal(globalObject as BrowserWindow, 'O2_RUM', openobserveRum)
