// Keep the following in sync with packages/rum/src/entries/main.ts
import type { RelativeTime } from '@openobserve/browser-core'
import { Observable, defineGlobal, getGlobalObject, noop } from '@openobserve/browser-core'
import type { RumPublicApi } from '@datadog/browser-rum-core'
import { makeRumPublicApi, startRum } from '@datadog/browser-rum-core'
import { getSessionReplayLink } from '../domain/getSessionReplayLink'

export {
  CommonProperties,
  RumPublicApi as RumGlobal,
  RumInitConfiguration,
  // Events
  RumEvent,
  RumActionEvent,
  RumErrorEvent,
  RumLongTaskEvent,
  RumResourceEvent,
  RumViewEvent,
  // Events context
  RumEventDomainContext,
  RumViewEventDomainContext,
  RumErrorEventDomainContext,
  RumActionEventDomainContext,
  RumFetchResourceEventDomainContext,
  RumXhrResourceEventDomainContext,
  RumOtherResourceEventDomainContext,
  RumLongTaskEventDomainContext,
} from '@datadog/browser-rum-core'
export { DefaultPrivacyLevel } from '@openobserve/browser-core'

export const datadogRum = makeRumPublicApi(startRum, {
  start: noop,
  stop: noop,
  onRumStart: noop,
  isRecording: () => false,
  getReplayStats: () => undefined,
  getSessionReplayLink,
  getSerializedNodeId: () => undefined,
  recorderStartObservable: new Observable<RelativeTime>(),
})

interface BrowserWindow extends Window {
  DD_RUM?: RumPublicApi
}
defineGlobal(getGlobalObject<BrowserWindow>(), 'DD_RUM', datadogRum)
