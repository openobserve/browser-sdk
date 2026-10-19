import type { DeflateEncoder, DeflateEncoderStreamId, DeflateWorker } from './deflate.types'

/**
 * Deflate capabilities (Worker and encoder) that can be used to compress intake requests.
 *
 * The Worker implementation (and its source code) ships with the RUM SDK. It registers itself here
 * so the other SDKs (ex: Logs) can start or reuse the same Worker without bundling it a second
 * time.
 */
export interface DeflateProvider {
  startDeflateWorker: (
    configuration: { workerUrl: string | undefined },
    source: string,
    onInitializationFailure: () => void
  ) => DeflateWorker | undefined
  createDeflateEncoder: (worker: DeflateWorker, streamId: DeflateEncoderStreamId) => DeflateEncoder
}

let deflateProvider: DeflateProvider | undefined

export function registerDeflateProvider(provider: DeflateProvider) {
  deflateProvider = provider
}

export function getDeflateProvider() {
  return deflateProvider
}

export function resetDeflateProvider() {
  deflateProvider = undefined
}
