import { noop } from '@openobserve/browser-core'
import type { RumConfiguration } from '@openobserve/browser-rum-core'
import type { ShadowRootsController } from '../shadowRootsController'
import { NodePrivacyLevel } from '../../../constants'

export const DEFAULT_SHADOW_ROOT_CONTROLLER: ShadowRootsController = {
  flush: noop,
  stop: noop,
  addShadowRoot: noop,
  removeShadowRoot: noop,
}
export const DEFAULT_CONFIGURATION = { defaultPrivacyLevel: NodePrivacyLevel.ALLOW } as RumConfiguration
