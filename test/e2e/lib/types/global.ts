import type { LogsGlobal } from '@openobserve/browser-logs'
import type { RumGlobal } from '@openobserve/browser-rum'

declare global {
  interface Window {
    OO_LOGS?: LogsGlobal
    OO_RUM?: RumGlobal
  }
}
