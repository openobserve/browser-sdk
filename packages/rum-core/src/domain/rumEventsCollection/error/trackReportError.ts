import type { Observable, RawError } from '@openobserve/browser-core'
import { clocksNow, ErrorHandling, ErrorSource, initReportObservable, RawReportType } from '@openobserve/browser-core'
import type { RumConfiguration } from '../../configuration'

export function trackReportError(configuration: RumConfiguration, errorObservable: Observable<RawError>) {
  const subscription = initReportObservable(configuration, [
    RawReportType.cspViolation,
    RawReportType.intervention,
  ]).subscribe((reportError) =>
    errorObservable.notify({
      startClocks: clocksNow(),
      message: reportError.message,
      stack: reportError.stack,
      type: reportError.subtype,
      source: ErrorSource.REPORT,
      handling: ErrorHandling.UNHANDLED,
    })
  )

  return {
    stop: () => {
      subscription.unsubscribe()
    },
  }
}
