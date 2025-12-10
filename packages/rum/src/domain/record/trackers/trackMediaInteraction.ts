import { DOM_EVENT, addEventListeners } from '@openobserve/browser-core'
import type { RumConfiguration } from '@openobserve/browser-rum-core'
import { NodePrivacyLevel, getNodePrivacyLevel } from '@openobserve/browser-rum-core'
import type { BrowserIncrementalSnapshotRecord, MediaInteractionData } from '../../../types'
import { IncrementalSource, MediaInteractionType } from '../../../types'
import { getEventTarget } from '../eventsUtils'
import { assembleIncrementalSnapshot } from '../assembly'
import type { SerializationScope } from '../serialization'
import type { Tracker } from './tracker.types'

export type MediaInteractionCallback = (incrementalSnapshotRecord: BrowserIncrementalSnapshotRecord) => void

export function trackMediaInteraction(
  configuration: RumConfiguration,
  scope: SerializationScope,
  mediaInteractionCb: MediaInteractionCallback
): Tracker {
  return addEventListeners(
    configuration,
    document,
    [DOM_EVENT.PLAY, DOM_EVENT.PAUSE],
    (event) => {
      const target = getEventTarget(event)
      if (!target) {
        return
      }
      const id = scope.nodeIds.get(target)
      if (
        id === undefined ||
        getNodePrivacyLevel(target, configuration.defaultPrivacyLevel) === NodePrivacyLevel.HIDDEN
      ) {
        return
      }
      mediaInteractionCb(
        assembleIncrementalSnapshot<MediaInteractionData>(IncrementalSource.MediaInteraction, {
          id,
          type: event.type === DOM_EVENT.PLAY ? MediaInteractionType.Play : MediaInteractionType.Pause,
        })
      )
    },
    {
      capture: true,
      passive: true,
    }
  )
}
