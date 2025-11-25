import type { Observable, RawError } from '@openobserve/browser-core'
import { initConsoleObservable, ConsoleApiName } from '@openobserve/browser-core'

export function trackConsoleError(errorObservable: Observable<RawError>) {
  const subscription = initConsoleObservable([ConsoleApiName.error]).subscribe((consoleLog) =>
    errorObservable.notify(consoleLog.error)
  )

  return {
    stop: () => {
      subscription.unsubscribe()
    },
  }
}
