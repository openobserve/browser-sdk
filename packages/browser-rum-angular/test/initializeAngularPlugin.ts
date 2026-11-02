import type {
  RumInitConfiguration,
  RumPluginOnInitOptions,
  RumPublicApi,
  StartRumResult,
} from '@openobserve/browser-rum-core'
import { noop } from '@openobserve/js-core/util'
import { angularPlugin, resetAngularPlugin } from '../src/domain/angularPlugin'
import { registerCleanupTask } from '../../browser-core/test'

export function initializeAngularPlugin({
  addError = noop,
}: {
  addError?: StartRumResult['addError']
} = {}) {
  resetAngularPlugin()
  const plugin = angularPlugin()

  // eslint-disable-next-line @typescript-eslint/no-floating-promises -- onInit never returns a promise for this plugin
  plugin.onInit!({
    publicApi: {} as RumPublicApi,
    initConfiguration: {} as RumInitConfiguration,
  } as RumPluginOnInitOptions)
  plugin.onRumStart!({ addError })

  registerCleanupTask(() => {
    resetAngularPlugin()
  })
}
