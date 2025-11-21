import type { Settings } from '../common/extension.types'
import { EventListeners } from '../common/eventListeners'
import { DEV_LOGS_URL, DEV_RUM_SLIM_URL, DEV_RUM_URL } from '../common/packagesUrlConstants'
import { SESSION_STORAGE_SETTINGS_KEY } from '../common/sessionKeyConstant'

declare global {
  interface Window extends EventTarget {
    OO_RUM?: SdkPublicApi
    OO_LOGS?: SdkPublicApi
    __ooBrowserSdkExtensionCallback?: (message: unknown) => void
  }
}

interface SdkPublicApi {
  [key: string]: (...args: any[]) => unknown
}

function main() {
  // Prevent multiple executions when the devetools are reconnecting
  if (window.__ooBrowserSdkExtensionCallback) {
    return
  }

  sendEventsToExtension()

  const settings = getSettings()

  if (
    settings &&
    // Avoid instrumenting SDK global variables if the SDKs are already loaded.
    // This happens when the page is loaded and then the devtools are opened.
    noBrowserSdkLoaded()
  ) {
    const ooRumGlobal = instrumentGlobal('OO_RUM')
    const ooLogsGlobal = instrumentGlobal('OO_LOGS')

    if (settings.debugMode) {
      setDebug(ooRumGlobal)
      setDebug(ooLogsGlobal)
    }

    if (settings.rumConfigurationOverride) {
      overrideInitConfiguration(ooRumGlobal, settings.rumConfigurationOverride)
    }

    if (settings.logsConfigurationOverride) {
      overrideInitConfiguration(ooLogsGlobal, settings.logsConfigurationOverride)
    }

    if (settings.useDevBundles === 'npm') {
      injectDevBundle(settings.useRumSlim ? DEV_RUM_SLIM_URL : DEV_RUM_URL, ooRumGlobal)
      injectDevBundle(DEV_LOGS_URL, ooLogsGlobal)
    }
  }
}

main()

function sendEventsToExtension() {
  // This script is executed in the "main" execution world, the same world as the webpage. Thus, it
  // can define a global callback variable to listen to SDK events.
  window.__ooBrowserSdkExtensionCallback = (message: unknown) => {
    // Relays any message to the "isolated" content-script via a custom event.
    window.dispatchEvent(
      new CustomEvent('__ooBrowserSdkMessage', {
        detail: message,
      })
    )
  }
}

function getSettings() {
  try {
    // sessionStorage access throws in sandboxed iframes
    const stringSettings = sessionStorage.getItem(SESSION_STORAGE_SETTINGS_KEY)
    // JSON.parse throws if the stringSettings is not a valid JSON
    return JSON.parse(stringSettings || 'null') as Settings | null
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error getting settings', error)
  }
}

function noBrowserSdkLoaded() {
  return !window.OO_RUM && !window.OO_LOGS
}

function injectDevBundle(url: string, global: GlobalInstrumentation) {
  loadSdkScriptFromURL(url)
  const devInstance = global.get() as SdkPublicApi

  if (devInstance) {
    global.onSet((sdkInstance) => proxySdk(sdkInstance, devInstance))
    global.returnValue(devInstance)
  }
}

function setDebug(global: GlobalInstrumentation) {
  global.onSet((sdkInstance) => {
    // Ensure the sdkInstance has a '_setDebug' method, excluding async stubs.
    if ('_setDebug' in sdkInstance) {
      sdkInstance._setDebug(true)
    }
  })
}

function overrideInitConfiguration(global: GlobalInstrumentation, configurationOverride: object) {
  global.onSet((sdkInstance) => {
    // Ensure the sdkInstance has an 'init' method, excluding async stubs.
    if ('init' in sdkInstance) {
      const originalInit = sdkInstance.init
      sdkInstance.init = (config: any) => {
        originalInit({
          ...config,
          ...configurationOverride,
          allowedTrackingOrigins: [location.origin],
        })
      }
    }
  })
}

function loadSdkScriptFromURL(url: string) {
  const xhr = new XMLHttpRequest()
  try {
    xhr.open('GET', url, false) // `false` makes the request synchronous
    xhr.send()
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[OO Browser SDK extension] Error while loading ${url}:`, error)
    return
  }
  if (xhr.status === 200) {
    let sdkCode = xhr.responseText

    // Webpack expects the script to be loaded with a `<script src="...">` tag to get its URL to
    // know where to load the relative chunks. By loading it with an XHR and evaluating it in an
    // inline script tag, Webpack does not know where to load the chunks from.
    //
    // Let's replace Webpack logic that breaks with our own logic to define the URL. It's not
    // pretty, but loading the script this way isn't either, so...
    //
    // We'll probably have to revisit when using actual `import()` expressions instead of relying on
    // Webpack runtime to load the chunks.
    sdkCode = sdkCode.replace(
      'if (!scriptUrl) throw new Error("Automatic publicPath is not supported in this browser");',
      `if (!scriptUrl) scriptUrl = ${JSON.stringify(url)};`
    )

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.text = sdkCode

    document.documentElement.prepend(script)
  }
}

type GlobalInstrumentation = ReturnType<typeof instrumentGlobal>
function instrumentGlobal(global: 'OO_RUM' | 'OO_LOGS') {
  const eventListeners = new EventListeners<SdkPublicApi>()
  let returnedInstance: SdkPublicApi | undefined
  let lastInstance: SdkPublicApi | undefined
  Object.defineProperty(window, global, {
    set(sdkInstance: SdkPublicApi) {
      eventListeners.notify(sdkInstance)
      lastInstance = sdkInstance
    },
    get(): SdkPublicApi | undefined {
      return returnedInstance ?? lastInstance
    },
  })

  return {
    get: () => window[global],
    onSet: (callback: (sdkInstance: SdkPublicApi) => void) => {
      eventListeners.subscribe(callback)
    },
    returnValue: (sdkInstance: SdkPublicApi) => {
      returnedInstance = sdkInstance
    },
  }
}

function proxySdk(target: SdkPublicApi, root: SdkPublicApi) {
  Object.assign(target, root)
}
