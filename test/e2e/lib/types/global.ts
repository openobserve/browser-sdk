import type { LogsGlobal } from '@openobserve/browser-logs'
import type { RumGlobal } from '@openobserve/browser-rum'

declare global {
  interface Window {
    DD_LOGS?: LogsGlobal
    DD_RUM?: RumGlobal
  }
}
