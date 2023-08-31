import type { RawError, Subscription } from '@openobserve/browser-core'
import { ErrorHandling, ErrorSource, Observable, clocksNow } from '@openobserve/browser-core'
import type { Clock } from '@openobserve/browser-core/test'
import { mockClock, stubReportingObserver } from '@openobserve/browser-core/test'
import type { RumConfiguration } from '../../configuration'
import { trackReportError } from './trackReportError'

describe('trackReportError', () => {
  let errorObservable: Observable<RawError>
  let subscription: Subscription
  let notifyLog: jasmine.Spy
  let clock: Clock
  let reportingObserverStub: { raiseReport(type: string): void; reset(): void }
  let configuration: RumConfiguration

  beforeEach(() => {
    configuration = {} as RumConfiguration
    errorObservable = new Observable()
    notifyLog = jasmine.createSpy('notifyLog')
    reportingObserverStub = stubReportingObserver()
    subscription = errorObservable.subscribe(notifyLog)
    clock = mockClock()
  })

  afterEach(() => {
    subscription.unsubscribe()
    clock.cleanup()
    reportingObserverStub.reset()
  })

  it('should track reports', () => {
    trackReportError(configuration, errorObservable)
    reportingObserverStub.raiseReport('intervention')

    expect(notifyLog).toHaveBeenCalledWith({
      startClocks: clocksNow(),
      message: jasmine.any(String),
      stack: jasmine.any(String),
      source: ErrorSource.REPORT,
      handling: ErrorHandling.UNHANDLED,
      type: 'NavigatorVibrate',
    })
  })
})
