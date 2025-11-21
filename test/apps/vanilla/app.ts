import { openobserveLogs } from '@openobserve/browser-logs'
import { openobserveRum } from '@openobserve/browser-rum'

declare global {
  interface Window {
    LOGS_INIT?: () => void
    RUM_INIT?: () => void
  }
}

if (typeof window !== 'undefined') {
  if (window.LOGS_INIT) {
    window.LOGS_INIT()
  }

  if (window.RUM_INIT) {
    window.RUM_INIT()
  }
} else {
  // compat test
  openobserveLogs.init({ clientToken: 'xxx', beforeSend: undefined })
  openobserveRum.init({ clientToken: 'xxx', applicationId: 'xxx', beforeSend: undefined })
  openobserveRum.setUser({ id: undefined })
}
