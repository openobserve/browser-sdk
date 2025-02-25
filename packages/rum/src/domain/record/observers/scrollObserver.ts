import type { DefaultPrivacyLevel, ListenerHandler } from '@openobserve/browser-core'
import { DOM_EVENT, throttle, addEventListener } from '@openobserve/browser-core'
import type { RumConfiguration } from '@openobserve/browser-rum-core'
import { getScrollX, getScrollY } from '@openobserve/browser-rum-core'
import type { ElementsScrollPositions } from '../elementsScrollPositions'
import { getEventTarget } from '../eventsUtils'
import { getNodePrivacyLevel } from '../privacy'
import { getSerializedNodeId, hasSerializedNode } from '../serialization'
import type { ScrollPosition } from '../../../types'
import { NodePrivacyLevel } from '../../../constants'

const SCROLL_OBSERVER_THRESHOLD = 100

export type ScrollCallback = (p: ScrollPosition) => void

export function initScrollObserver(
  configuration: RumConfiguration,
  cb: ScrollCallback,
  defaultPrivacyLevel: DefaultPrivacyLevel,
  elementsScrollPositions: ElementsScrollPositions
): ListenerHandler {
  const { throttled: updatePosition } = throttle((event: Event) => {
    const target = getEventTarget(event) as HTMLElement | Document
    if (
      !target ||
      getNodePrivacyLevel(target, defaultPrivacyLevel) === NodePrivacyLevel.HIDDEN ||
      !hasSerializedNode(target)
    ) {
      return
    }
    const id = getSerializedNodeId(target)
    const scrollPositions =
      target === document
        ? {
          scrollTop: getScrollY(),
          scrollLeft: getScrollX(),
        }
        : {
          scrollTop: Math.round((target as HTMLElement).scrollTop),
          scrollLeft: Math.round((target as HTMLElement).scrollLeft),
        }
    elementsScrollPositions.set(target, scrollPositions)
    cb({
      id,
      x: scrollPositions.scrollLeft,
      y: scrollPositions.scrollTop,
    })
  }, SCROLL_OBSERVER_THRESHOLD)
  return addEventListener(configuration, document, DOM_EVENT.SCROLL, updatePosition, { capture: true, passive: true })
    .stop
}
