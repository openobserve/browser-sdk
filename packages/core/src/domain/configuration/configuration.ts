import { catchUserErrors } from '../../tools/catchUserErrors'
import { display } from '../../tools/display'
import type { RawTelemetryConfiguration } from '../telemetry'
import { ExperimentalFeature, addExperimentalFeatures } from '../../tools/experimentalFeatures'
import type { Duration } from '../../tools/utils/timeUtils'
import { ONE_SECOND } from '../../tools/utils/timeUtils'
import { isPercentage } from '../../tools/utils/numberUtils'
import { ONE_KIBI_BYTE } from '../../tools/utils/byteUtils'
import { objectHasValue } from '../../tools/utils/objectUtils'
import { assign } from '../../tools/utils/polyfills'
import { selectSessionStoreStrategyType } from '../session/sessionStore'
import type { SessionStoreStrategyType } from '../session/storeStrategies/sessionStoreStrategy'
import type { TransportConfiguration } from './transportConfiguration'
import { computeTransportConfiguration } from './transportConfiguration'

export const DefaultPrivacyLevel = {
  ALLOW: 'allow',
  MASK: 'mask',
  MASK_USER_INPUT: 'mask-user-input',
} as const
export type DefaultPrivacyLevel = (typeof DefaultPrivacyLevel)[keyof typeof DefaultPrivacyLevel]

export interface InitConfiguration {
  // global options
  clientToken: string
  beforeSend?: GenericBeforeSendCallback | undefined
  /**
   * @deprecated use sessionSampleRate instead
   */
  sampleRate?: number | undefined
  sessionSampleRate?: number | undefined
  telemetrySampleRate?: number | undefined
  silentMultipleInit?: boolean | undefined
  trackResources?: boolean | undefined
  trackLongTasks?: boolean | undefined

  // transport options
  proxy?: string | undefined
  /**
   * @deprecated use `proxy` instead
   */
  proxyUrl?: string | undefined
  site?: string | undefined

  // tag and context options
  service: string | undefined
  env: string | undefined
  version: string | undefined

  // cookie options
  useCrossSiteSessionCookie?: boolean | undefined
  useSecureSessionCookie?: boolean | undefined
  trackSessionAcrossSubdomains?: boolean | undefined

  // alternate storage option
  allowFallbackToLocalStorage?: boolean | undefined

  // internal options
  enableExperimentalFeatures?: string[] | undefined
  replica?: ReplicaUserConfiguration | undefined
  datacenter?: string
  internalAnalyticsSubdomain?: string

  telemetryConfigurationSampleRate?: number

  apiVersion: string
  organizationIdentifier: string
  insecureHTTP: boolean
}

// This type is only used to build the core configuration. Logs and RUM SDKs are using a proper type
// for this option.
type GenericBeforeSendCallback = (event: any, context?: any) => unknown

interface ReplicaUserConfiguration {
  applicationId?: string
  clientToken: string
}

export interface Configuration extends TransportConfiguration {
  // Built from init configuration
  beforeSend: GenericBeforeSendCallback | undefined
  sessionStoreStrategyType: SessionStoreStrategyType | undefined
  sessionSampleRate: number
  telemetrySampleRate: number
  telemetryConfigurationSampleRate: number
  service: string | undefined
  silentMultipleInit: boolean

  // Event limits
  eventRateLimiterThreshold: number // Limit the maximum number of actions, errors and logs per minutes
  maxTelemetryEventsPerPage: number

  // Batch configuration
  batchBytesLimit: number
  flushTimeout: Duration
  batchMessagesLimit: number
  messageBytesLimit: number
}

export function validateAndBuildConfiguration(initConfiguration: InitConfiguration): Configuration | undefined {
  if (!initConfiguration || !initConfiguration.clientToken) {
    display.error('Client Token is not configured, we will not send any data.')
    return
  }

  const sessionSampleRate = initConfiguration.sessionSampleRate ?? initConfiguration.sampleRate
  if (sessionSampleRate !== undefined && !isPercentage(sessionSampleRate)) {
    display.error('Session Sample Rate should be a number between 0 and 100')
    return
  }

  if (initConfiguration.telemetrySampleRate !== undefined && !isPercentage(initConfiguration.telemetrySampleRate)) {
    display.error('Telemetry Sample Rate should be a number between 0 and 100')
    return
  }

  if (
    initConfiguration.telemetryConfigurationSampleRate !== undefined &&
    !isPercentage(initConfiguration.telemetryConfigurationSampleRate)
  ) {
    display.error('Telemetry Configuration Sample Rate should be a number between 0 and 100')
    return
  }

  // Set the experimental feature flags as early as possible, so we can use them in most places
  if (Array.isArray(initConfiguration.enableExperimentalFeatures)) {
    addExperimentalFeatures(
      initConfiguration.enableExperimentalFeatures.filter((flag): flag is ExperimentalFeature =>
        objectHasValue(ExperimentalFeature, flag)
      )
    )
  }

  return assign(
    {
      beforeSend:
        initConfiguration.beforeSend && catchUserErrors(initConfiguration.beforeSend, 'beforeSend threw an error:'),
      sessionStoreStrategyType: selectSessionStoreStrategyType(initConfiguration),
      sessionSampleRate: sessionSampleRate ?? 100,
      telemetrySampleRate: initConfiguration.telemetrySampleRate ?? 20,
      telemetryConfigurationSampleRate: initConfiguration.telemetryConfigurationSampleRate ?? 5,
      service: initConfiguration.service,
      silentMultipleInit: !!initConfiguration.silentMultipleInit,

      /**
       * beacon payload max queue size implementation is 64kb
       * ensure that we leave room for logs, rum and potential other users
       */
      batchBytesLimit: 16 * ONE_KIBI_BYTE,

      eventRateLimiterThreshold: 3000,
      maxTelemetryEventsPerPage: 15,

      /**
       * flush automatically, aim to be lower than ALB connection timeout
       * to maximize connection reuse.
       */
      flushTimeout: (30 * ONE_SECOND) as Duration,

      /**
       * Logs intake limit
       */
      batchMessagesLimit: 50,
      messageBytesLimit: 256 * ONE_KIBI_BYTE,

      apiVersion: initConfiguration.apiVersion ?? 'v1',
      organizationIdentifier: initConfiguration.organizationIdentifier,
      insecureHTTP: initConfiguration.insecureHTTP,
    },
    computeTransportConfiguration(initConfiguration)
  )
}

export function serializeConfiguration(initConfiguration: InitConfiguration): Partial<RawTelemetryConfiguration> {
  const proxy = initConfiguration.proxy ?? initConfiguration.proxyUrl
  return {
    session_sample_rate: initConfiguration.sessionSampleRate ?? initConfiguration.sampleRate,
    telemetry_sample_rate: initConfiguration.telemetrySampleRate,
    telemetry_configuration_sample_rate: initConfiguration.telemetryConfigurationSampleRate,
    use_before_send: !!initConfiguration.beforeSend,
    use_cross_site_session_cookie: initConfiguration.useCrossSiteSessionCookie,
    use_secure_session_cookie: initConfiguration.useSecureSessionCookie,
    use_proxy: proxy !== undefined ? !!proxy : undefined,
    silent_multiple_init: initConfiguration.silentMultipleInit,
    track_session_across_subdomains: initConfiguration.trackSessionAcrossSubdomains,
    track_resources: initConfiguration.trackResources,
    track_long_task: initConfiguration.trackLongTasks,
    allow_fallback_to_local_storage: !!initConfiguration.allowFallbackToLocalStorage,
  }
}
