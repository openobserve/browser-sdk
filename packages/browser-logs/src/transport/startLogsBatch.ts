import type {
  Context,
  Encoder,
  Observable,
  PageMayExitEvent,
  RawError,
  SessionManager,
} from '@openobserve/browser-core'
import {
  createBatch,
  createEndpointBuilder,
  createReplicaEndpointBuilder,
  createFlushController,
  createHttpRequest,
  createIdentityEncoder,
  DeflateEncoderStreamId,
  display,
  getDeflateProvider,
  noop,
} from '@openobserve/browser-core'
import type { LogsConfiguration } from '../domain/configuration'
import type { LifeCycle } from '../domain/lifeCycle'
import { LifeCycleEventType } from '../domain/lifeCycle'
import type { LogsEvent } from '../logsEvent.types'

/**
 * Create the encoder used to batch logs: a deflate encoder (running in the Worker shared with the RUM
 * SDK) when `compressIntakeRequests` is enabled and the Worker is available, the identity encoder
 * otherwise.
 */
function createLogsEncoder(configuration: LogsConfiguration): Encoder {
  if (!configuration.compressIntakeRequests) {
    return createIdentityEncoder()
  }

  const deflateProvider = getDeflateProvider()
  if (!deflateProvider) {
    display.warn(
      'Datadog Logs: `compressIntakeRequests` requires the RUM SDK (@openobserve/browser-rum) to be loaded in the same page. Logs are sent uncompressed.'
    )
    return createIdentityEncoder()
  }

  const deflateWorker = deflateProvider.startDeflateWorker(
    configuration,
    'Datadog Logs',
    // Worker initialization can fail asynchronously, especially in Firefox where even CSP issues
    // are reported asynchronously. Like the RUM SDK, the SDK continues its execution even if data
    // won't be sent.
    noop
  )
  if (!deflateWorker) {
    // `startDeflateWorker` already displayed an error explaining the issue: keep sending logs
    // uncompressed rather than dropping them.
    return createIdentityEncoder()
  }

  return deflateProvider.createDeflateEncoder(deflateWorker, DeflateEncoderStreamId.LOGS)
}

export function startLogsBatch(
  configuration: LogsConfiguration,
  lifeCycle: LifeCycle,
  reportError: (error: RawError) => void,
  pageMayExitObservable: Observable<PageMayExitEvent>,
  sessionManager: SessionManager
) {
  const endpoints = [createEndpointBuilder(configuration, 'logs')]
  const replicaEndpoint = createReplicaEndpointBuilder(configuration, 'logs')
  if (replicaEndpoint) {
    endpoints.push(replicaEndpoint)
  }

  const batch = createBatch({
    encoder: createLogsEncoder(configuration),
    request: createHttpRequest(endpoints, reportError),
    flushController: createFlushController({
      pageMayExitObservable,
      sessionExpireObservable: sessionManager.expireObservable,
    }),
  })

  lifeCycle.subscribe(LifeCycleEventType.LOG_COLLECTED, (serverLogsEvent: LogsEvent & Context) => {
    batch.add(serverLogsEvent)
  })

  return batch
}
