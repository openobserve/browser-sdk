import type { Context, RawError, EventRateLimiter, User } from '@openobserve/browser-core'
import {
  combine,
  isEmptyObject,
  timeStampNow,
  currentDrift,
  display,
  createEventRateLimiter,
  canUseEventBridge,
  assign,
  round,
  dateNow,
} from '@openobserve/browser-core'
import type { RumEventDomainContext } from '../domainContext.types'
import type {
  RawRumErrorEvent,
  RawRumEvent,
  RawRumLongTaskEvent,
  RawRumResourceEvent,
  RumContext,
} from '../rawRumEvent.types'
import { RumEventType } from '../rawRumEvent.types'
import type { RumEvent } from '../rumEvent.types'
import { getSyntheticsContext } from './contexts/syntheticsContext'
import { getCiTestContext } from './contexts/ciTestContext'
import type { LifeCycle } from './lifeCycle'
import { LifeCycleEventType } from './lifeCycle'
import type { ViewContexts } from './contexts/viewContexts'
import type { RumSessionManager } from './rumSessionManager'
import type { UrlContexts } from './contexts/urlContexts'
import type { RumConfiguration } from './configuration'
import type { ActionContexts } from './rumEventsCollection/action/actionCollection'
import { getDisplayContext } from './contexts/displayContext'
import type { CommonContext } from './contexts/commonContext'
import type { ModifiableFieldPaths } from './limitModification'
import { limitModification } from './limitModification'

// replaced at build time
declare const __BUILD_ENV__SDK_VERSION__: string

const enum SessionType {
  SYNTHETICS = 'synthetics',
  USER = 'user',
  CI_TEST = 'ci_test',
}

const VIEW_MODIFIABLE_FIELD_PATHS: ModifiableFieldPaths = {
  'view.url': 'string',
  'view.referrer': 'string',
}

const USER_CUSTOMIZABLE_FIELD_PATHS: ModifiableFieldPaths = {
  context: 'object',
}

let modifiableFieldPathsByEvent: { [key in RumEventType]: ModifiableFieldPaths }

type Mutable<T> = { -readonly [P in keyof T]: T[P] }

export function startRumAssembly(
  configuration: RumConfiguration,
  lifeCycle: LifeCycle,
  sessionManager: RumSessionManager,
  viewContexts: ViewContexts,
  urlContexts: UrlContexts,
  actionContexts: ActionContexts,
  buildCommonContext: () => CommonContext,
  reportError: (error: RawError) => void
) {
  modifiableFieldPathsByEvent = {
    [RumEventType.VIEW]: VIEW_MODIFIABLE_FIELD_PATHS,
    [RumEventType.ERROR]: assign(
      {
        'error.message': 'string',
        'error.stack': 'string',
        'error.resource.url': 'string',
        'error.fingerprint': 'string',
      },
      USER_CUSTOMIZABLE_FIELD_PATHS,
      VIEW_MODIFIABLE_FIELD_PATHS
    ),
    [RumEventType.RESOURCE]: assign(
      {
        'resource.url': 'string',
      },
      USER_CUSTOMIZABLE_FIELD_PATHS,
      VIEW_MODIFIABLE_FIELD_PATHS
    ),
    [RumEventType.ACTION]: assign(
      {
        'action.target.name': 'string',
      },
      USER_CUSTOMIZABLE_FIELD_PATHS,
      VIEW_MODIFIABLE_FIELD_PATHS
    ),
    [RumEventType.LONG_TASK]: assign({}, USER_CUSTOMIZABLE_FIELD_PATHS, VIEW_MODIFIABLE_FIELD_PATHS),
  }
  const eventRateLimiters = {
    [RumEventType.ERROR]: createEventRateLimiter(
      RumEventType.ERROR,
      configuration.eventRateLimiterThreshold,
      reportError
    ),
    [RumEventType.ACTION]: createEventRateLimiter(
      RumEventType.ACTION,
      configuration.eventRateLimiterThreshold,
      reportError
    ),
  }

  const syntheticsContext = getSyntheticsContext()
  const ciTestContext = getCiTestContext()

  lifeCycle.subscribe(
    LifeCycleEventType.RAW_RUM_EVENT_COLLECTED,
    ({ startTime, rawRumEvent, domainContext, savedCommonContext, customerContext }) => {
      const viewContext = viewContexts.findView(startTime)
      const urlContext = urlContexts.findUrl(startTime)
      const session = sessionManager.findTrackedSession(startTime)

      const sessionId = sessionStorage.getItem('oo_rum_session_id');
      const sessionStartTimeFromStorage = sessionStorage.getItem('oo_rum_session_starttime');

      console.log('sessionId: ', sessionId, ' ==> sessionStartTimeFromStorage: ', sessionStartTimeFromStorage, ' ==> session: ', session);
      if (!sessionId || sessionId !== session?.id || !sessionStartTimeFromStorage) {
          const sessionStartTime = (new Date().getTime()).toString();
          sessionStorage.setItem('oo_rum_session_id', session?.id || '');
          sessionStorage.setItem('oo_rum_session_starttime', sessionStartTime);
      }
      
      if (session && viewContext && urlContext) {
        const commonContext = savedCommonContext || buildCommonContext()
        const actionId = actionContexts.findActionId(startTime)

        const rumContext: RumContext = {
          _oo: {
            format_version: 2,
            drift: currentDrift(),
            session: {
              plan: session.plan,
            },
            configuration: {
              session_sample_rate: round(configuration.sessionSampleRate, 3),
              session_replay_sample_rate: round(configuration.sessionReplaySampleRate, 3),
            },
            browser_sdk_version: canUseEventBridge() ? __BUILD_ENV__SDK_VERSION__ : undefined,
          },
          application: {
            id: configuration.applicationId,
          },
          date: timeStampNow(),
          service: viewContext.service || configuration.service,
          version: viewContext.version || configuration.version,
          source: 'browser',
          session: {
            id: session.id,
            type: syntheticsContext ? SessionType.SYNTHETICS : ciTestContext ? SessionType.CI_TEST : SessionType.USER,
            start_time: parseInt(sessionStorage.getItem('oo_rum_session_starttime') || dateNow.toString(), 10),
          },
          view: {
            id: viewContext.id,
            name: viewContext.name,
            url: urlContext.url,
            referrer: urlContext.referrer,
          },
          action: needToAssembleWithAction(rawRumEvent) && actionId ? { id: actionId } : undefined,
          synthetics: syntheticsContext,
          ci_test: ciTestContext,
          display: getDisplayContext(configuration),
        }

        const serverRumEvent = combine(rumContext as RumContext & Context, rawRumEvent) as RumEvent & Context
        serverRumEvent.context = combine(commonContext.context, customerContext)

        if (!('has_replay' in serverRumEvent.session)) {
          ; (serverRumEvent.session as Mutable<RumEvent['session']>).has_replay = commonContext.hasReplay
        }

        if (!isEmptyObject(commonContext.user)) {
          ; (serverRumEvent.usr as Mutable<RumEvent['usr']>) = commonContext.user as User & Context
        }

        if (shouldSend(serverRumEvent, configuration.beforeSend, domainContext, eventRateLimiters)) {
          if (isEmptyObject(serverRumEvent.context)) {
            delete serverRumEvent.context
          }
          lifeCycle.notify(LifeCycleEventType.RUM_EVENT_COLLECTED, serverRumEvent)
        }
      }
    }
  )
}

function shouldSend(
  event: RumEvent & Context,
  beforeSend: RumConfiguration['beforeSend'],
  domainContext: RumEventDomainContext,
  eventRateLimiters: { [key in RumEventType]?: EventRateLimiter }
) {
  if (beforeSend) {
    const result = limitModification(event, modifiableFieldPathsByEvent[event.type], (event) =>
      beforeSend(event, domainContext)
    )
    if (result === false && event.type !== RumEventType.VIEW) {
      return false
    }
    if (result === false) {
      display.warn("Can't dismiss view events using beforeSend!")
    }
  }

  const rateLimitReached = eventRateLimiters[event.type]?.isLimitReached()
  return !rateLimitReached
}

function needToAssembleWithAction(
  event: RawRumEvent
): event is RawRumErrorEvent | RawRumResourceEvent | RawRumLongTaskEvent {
  return [RumEventType.ERROR, RumEventType.RESOURCE, RumEventType.LONG_TASK].indexOf(event.type) !== -1
}
