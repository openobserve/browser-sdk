import { instrumentMethod } from '@openobserve/browser-core'
import { Observable } from '@openobserve/js-core/util'

export function createWindowOpenObservable() {
  const observable = new Observable<void>()
  const { stop } = instrumentMethod(window, 'open', () => observable.notify())
  return { observable, stop }
}
