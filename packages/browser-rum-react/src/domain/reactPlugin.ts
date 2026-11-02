import { version as reactVersion } from 'react'
import { toIntegrations, toMajorVersionIntegration } from '@openobserve/browser-core'
import type { RumPlugin, RumPublicApi, StartRumResult } from '@openobserve/browser-rum-core'

type ReactRouterType = 'react-router-v6' | 'react-router-v7' | 'react-router-v8' | 'tanstack-router-v1'
type InitSubscriber = (configuration: ReactPluginConfiguration, rumPublicApi: RumPublicApi) => void
type StartSubscriber = (addError: StartRumResult['addError']) => void

let globalPublicApi: RumPublicApi | undefined
let globalConfiguration: ReactPluginConfiguration | undefined
let globalAddError: StartRumResult['addError'] | undefined
let routerType: ReactRouterType | undefined

const onRumInitSubscribers: InitSubscriber[] = []
const onRumStartSubscribers: StartSubscriber[] = []

/**
 * React plugin configuration.
 *
 * @category Main
 */
export interface ReactPluginConfiguration {
  /**
   * Enable router integration. Make sure to use functions from
   * {@link @openobserve/browser-rum-react/react-router! | @openobserve/browser-rum-react/react-router} or
   * {@link @openobserve/browser-rum-react/tanstack-router! | @openobserve/browser-rum-react/tanstack-router}
   * to create the router.
   * ```
   */
  router?: boolean
}

/**
 * React plugin type.
 *
 * The plugins API is unstable and experimental, and may change without notice. Please don't use this type directly.
 *
 * @internal
 */
export type ReactPlugin = Required<RumPlugin>

/**
 * React plugin constructor.
 *
 * @category Main
 * @example
 * ```ts
 * import { openobserveRum } from '@openobserve/browser-rum'
 * import { reactPlugin } from '@openobserve/browser-rum-react'
 *
 * openobserveRum.init({
 *   applicationId: '<OPENOBSERVE_APPLICATION_ID>',
 *   clientToken: '<OPENOBSERVE_CLIENT_TOKEN>',
 *   site: '<OPENOBSERVE_SITE>',
 *   plugins: [reactPlugin()],
 *   // ...
 * })
 * ```
 */
export function reactPlugin(configuration: ReactPluginConfiguration = {}): ReactPlugin {
  return {
    name: 'react',
    onInit({ publicApi, initConfiguration }) {
      globalPublicApi = publicApi
      globalConfiguration = configuration
      for (const subscriber of onRumInitSubscribers) {
        subscriber(globalConfiguration, globalPublicApi)
      }
      if (configuration.router) {
        initConfiguration.trackViewsManually = true
      }
    },
    onRumStart({ addError }) {
      globalAddError = addError
      for (const subscriber of onRumStartSubscribers) {
        if (addError) {
          subscriber(addError)
        }
      }
    },
    getConfigurationTelemetry() {
      const reactIntegration = toMajorVersionIntegration('react', reactVersion)
      return {
        router: !!configuration.router,
        integrations: toIntegrations(reactIntegration, configuration.router && routerType),
      }
    },
  } satisfies RumPlugin
}

export function setReactRouterType(type: ReactRouterType) {
  routerType = type
}

export function onRumInit(callback: InitSubscriber) {
  if (globalConfiguration && globalPublicApi) {
    callback(globalConfiguration, globalPublicApi)
  } else {
    onRumInitSubscribers.push(callback)
  }
}

export function onRumStart(callback: StartSubscriber) {
  if (globalAddError) {
    callback(globalAddError)
  } else {
    onRumStartSubscribers.push(callback)
  }
}

export function resetReactPlugin() {
  globalPublicApi = undefined
  globalConfiguration = undefined
  globalAddError = undefined
  routerType = undefined
  onRumInitSubscribers.length = 0
  onRumStartSubscribers.length = 0
}
