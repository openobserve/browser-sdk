import type { NetworkInformation } from '@openobserve/js-core/util'
import { registerCleanupTask } from '../registerCleanupTask'

export function setNavigatorOnLine(onLine: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    get() {
      return onLine
    },
    configurable: true,
  })
  registerCleanupTask(() => {
    delete (navigator as any).onLine
  })
}

export function setNavigatorConnection(connection: Partial<NetworkInformation> | undefined) {
  Object.defineProperty(navigator, 'connection', {
    get() {
      return connection
    },
    configurable: true,
  })
  registerCleanupTask(() => {
    delete (navigator as any).connection
  })
}
