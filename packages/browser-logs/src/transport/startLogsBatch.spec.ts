import type { Context, DeflateWorker, PageMayExitEvent } from '@openobserve/browser-core'
import {
  DeflateEncoderStreamId,
  FLUSH_DURATION_LIMIT,
  Observable,
  display,
  noop,
  registerDeflateProvider,
  resetDeflateProvider,
} from '@openobserve/browser-core'
import type { Clock } from '@openobserve/browser-core/test'
import {
  createSessionManagerMock,
  interceptRequests,
  mockClock,
  registerCleanupTask,
} from '@openobserve/browser-core/test'
import { MockWorker } from '../../../browser-rum/test'
import { createDeflateEncoder } from '../../../browser-rum/src/domain/deflate'
import type { LogsConfiguration } from '../domain/configuration'
import { validateAndBuildLogsConfiguration } from '../domain/configuration'
import { LifeCycle, LifeCycleEventType } from '../domain/lifeCycle'
import type { LogsEvent } from '../logsEvent.types'
import { startLogsBatch } from './startLogsBatch'

describe('startLogsBatch', () => {
  let interceptor: ReturnType<typeof interceptRequests>
  let clock: Clock
  let lifeCycle: LifeCycle
  let worker: MockWorker

  beforeEach(() => {
    clock = mockClock()
    interceptor = interceptRequests()
    lifeCycle = new LifeCycle()
    worker = new MockWorker()
    registerCleanupTask(resetDeflateProvider)
  })

  function start(initConfiguration: Partial<Parameters<typeof validateAndBuildLogsConfiguration>[0]> = {}) {
    const configuration: LogsConfiguration = validateAndBuildLogsConfiguration({
      clientToken: 'xxx',
      telemetrySampleRate: 0,
      ...initConfiguration,
    })!
    const batch = startLogsBatch(
      configuration,
      lifeCycle,
      noop,
      new Observable<PageMayExitEvent>(),
      createSessionManagerMock()
    )
    registerCleanupTask(() => batch.stop())
    return configuration
  }

  function collectLog(message: string) {
    lifeCycle.notify(LifeCycleEventType.LOG_COLLECTED, { message, status: 'info' } as unknown as LogsEvent & Context)
  }

  function registerMockedProvider(startDeflateWorker: () => DeflateWorker | undefined = () => worker) {
    const startDeflateWorkerSpy = jasmine.createSpy('startDeflateWorker').and.callFake(startDeflateWorker)
    const createDeflateEncoderSpy = jasmine.createSpy('createDeflateEncoder').and.callFake(createDeflateEncoder)
    registerDeflateProvider({
      startDeflateWorker: startDeflateWorkerSpy,
      createDeflateEncoder: createDeflateEncoderSpy,
    })
    return { startDeflateWorkerSpy, createDeflateEncoderSpy }
  }

  describe('without compressIntakeRequests', () => {
    it('sends uncompressed logs and does not start the worker', async () => {
      const { startDeflateWorkerSpy } = registerMockedProvider()
      start()

      collectLog('foo')
      clock.tick(FLUSH_DURATION_LIMIT)
      await interceptor.waitForAllFetchCalls()

      expect(startDeflateWorkerSpy).not.toHaveBeenCalled()
      expect(interceptor.requests.length).toBe(1)
      expect(interceptor.requests[0].url).not.toContain('o2-evp-encoding')
      expect(JSON.parse(interceptor.requests[0].body)).toEqual(jasmine.objectContaining({ message: 'foo' }))
    })
  })

  describe('with compressIntakeRequests', () => {
    it('starts (or reuses) the deflate worker with the logs configuration', () => {
      const { startDeflateWorkerSpy, createDeflateEncoderSpy } = registerMockedProvider()

      const configuration = start({ compressIntakeRequests: true, workerUrl: '/worker.js' })

      expect(configuration.workerUrl).toBe('/worker.js')
      expect(startDeflateWorkerSpy).toHaveBeenCalledOnceWith(configuration, jasmine.any(String), jasmine.any(Function))
      expect(createDeflateEncoderSpy).toHaveBeenCalledOnceWith(worker, DeflateEncoderStreamId.LOGS)
    })

    it('sends deflate encoded logs', async () => {
      registerMockedProvider()
      start({ compressIntakeRequests: true })

      collectLog('foo')
      clock.tick(FLUSH_DURATION_LIMIT)
      worker.processAllMessages()
      await interceptor.waitForAllFetchCalls()

      expect(interceptor.requests.length).toBe(1)
      expect(interceptor.requests[0].url).toContain('o2-evp-encoding=deflate')
      // The mocked worker does not compress: it outputs the UTF-8 encoded data
      const body = await (interceptor.requests[0].body as unknown as Blob).text()
      expect(JSON.parse(body.trim())).toEqual(jasmine.objectContaining({ message: 'foo' }))
    })

    it('falls back to uncompressed logs and warns when no deflate provider is registered', async () => {
      const warnSpy = spyOn(display, 'warn')
      start({ compressIntakeRequests: true })

      collectLog('foo')
      clock.tick(FLUSH_DURATION_LIMIT)
      await interceptor.waitForAllFetchCalls()

      expect(warnSpy).toHaveBeenCalledOnceWith(jasmine.stringContaining('compressIntakeRequests'))
      expect(interceptor.requests[0].url).not.toContain('o2-evp-encoding')
      expect(JSON.parse(interceptor.requests[0].body)).toEqual(jasmine.objectContaining({ message: 'foo' }))
    })

    it('falls back to uncompressed logs when the worker cannot be started', async () => {
      const { createDeflateEncoderSpy } = registerMockedProvider(() => undefined)
      start({ compressIntakeRequests: true })

      collectLog('foo')
      clock.tick(FLUSH_DURATION_LIMIT)
      await interceptor.waitForAllFetchCalls()

      expect(createDeflateEncoderSpy).not.toHaveBeenCalled()
      expect(interceptor.requests[0].url).not.toContain('o2-evp-encoding')
      expect(JSON.parse(interceptor.requests[0].body)).toEqual(jasmine.objectContaining({ message: 'foo' }))
    })
  })
})
