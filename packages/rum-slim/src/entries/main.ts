// Keep the following in sync with packages/rum/src/entries/main.ts
import { defineGlobal, getGlobalObject } from '@openobserve/browser-core'
import type { RumPublicApi } from '@openobserve/browser-rum-core'
import { makeRumPublicApi, startRum } from '@openobserve/browser-rum-core'
import { makeStubRecorderApi } from '../boot/stubRecorderApi'

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
} from '@openobserve/browser-rum-core'
export { DefaultPrivacyLevel } from '@openobserve/browser-core'

export const openobserveRum = makeRumPublicApi(startRum, makeStubRecorderApi())

interface BrowserWindow extends Window {
  OO_RUM?: RumPublicApi
}
defineGlobal(getGlobalObject<BrowserWindow>(), 'OO_RUM', openobserveRum)
