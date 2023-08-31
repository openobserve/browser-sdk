import type { ListenerHandler } from '@openobserve/browser-core'
import { DOM_EVENT, addEventListeners } from '@openobserve/browser-core'
import type { RumConfiguration } from '@openobserve/browser-rum-core'
import type { FocusRecord } from '../../../types'

export type FocusCallback = (data: FocusRecord['data']) => void

export function initFocusObserver(configuration: RumConfiguration, focusCb: FocusCallback): ListenerHandler {
  return addEventListeners(configuration, window, [DOM_EVENT.FOCUS, DOM_EVENT.BLUR], () => {
    focusCb({ has_focus: document.hasFocus() })
  }).stop
}
