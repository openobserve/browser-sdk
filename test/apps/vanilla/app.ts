import { openobserveLogs } from '@openobserve/browser-logs'
import { openobserveRum } from '@openobserve/browser-rum'
import { datadogDebugger } from '@openobserve/browser-debugger'
import { wasmPlugin } from '@openobserve/browser-plugin-wasm'

declare global {
  interface Window {
    LOGS_INIT?: () => void
    RUM_INIT?: () => void
    DEBUGGER_INIT?: () => void
    DD_WASM_PLUGIN?: typeof wasmPlugin
  }
}

if (typeof window !== 'undefined') {
  // Expose the WebAssembly plugin so E2E tests can register it on the RUM/Logs SDKs that share
  // this bundle's browser-core instance (and thus its wasm module registry).
  window.DD_WASM_PLUGIN = wasmPlugin

  if (window.LOGS_INIT) {
    window.LOGS_INIT()
  }

  if (window.RUM_INIT) {
    window.RUM_INIT()
  }

  if (window.DEBUGGER_INIT) {
    window.DEBUGGER_INIT()
  }
} else {
  // compat test
  openobserveLogs.init({ clientToken: 'xxx', beforeSend: undefined })
  openobserveRum.init({ clientToken: 'xxx', applicationId: 'xxx', beforeSend: undefined })
  openobserveRum.setUser({ id: undefined })
  datadogDebugger.init({ clientToken: 'xxx', service: 'xxx' })
}
