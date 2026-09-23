import type { RumInitConfiguration, RumPublicApi } from '@openobserve/browser-rum-core'
import type { LogsInitConfiguration, LogsGlobal } from '@openobserve/browser-logs'
import type { Context } from '@openobserve/browser-core'

declare global {
  interface Window {
    RUM_BUNDLE_URL?: string
    LOGS_BUNDLE_URL?: string
    EXT_RUM_CONFIGURATION?: RumInitConfiguration
    RUM_CONTEXT?: Context
    EXT_LOGS_CONFIGURATION?: LogsInitConfiguration
    LOGS_CONTEXT?: Context
    O2_RUM?: RumPublicApi
    O2_LOGS?: LogsGlobal
  }
}

function load<T extends 'O2_RUM' | 'O2_LOGS'>(
  sdk: T,
  url: string,
  initConfig: T extends 'O2_RUM' ? RumInitConfiguration : LogsInitConfiguration,
  globalContext?: Context
) {
  const script = document.createElement('script')
  script.src = url
  script.crossOrigin = ''
  script.onload = () => {
    if (!window[sdk]) {
      console.error(`${sdk} is not loaded`)
      return
    }

    window[sdk].init(initConfig as any)
    if (globalContext) {
      window[sdk].setGlobalContext(globalContext)
    }
  }

  document.documentElement.appendChild(script)
}

if (window.RUM_BUNDLE_URL && window.EXT_RUM_CONFIGURATION) {
  load('O2_RUM', window.RUM_BUNDLE_URL, window.EXT_RUM_CONFIGURATION, window.RUM_CONTEXT)
}

if (window.LOGS_BUNDLE_URL && window.EXT_LOGS_CONFIGURATION) {
  load('O2_LOGS', window.LOGS_BUNDLE_URL, window.EXT_LOGS_CONFIGURATION, window.LOGS_CONTEXT)
}
