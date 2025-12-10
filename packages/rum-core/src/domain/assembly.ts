import type { RawError, EventRateLimiter } from '@openobserve/browser-core'
import {
  combine,
  isEmptyObject,
  display,
  createEventRateLimiter,
  HookNames,
  DISCARDED,
  buildTags,
} from '@openobserve/browser-core'
import type { RumEventDomainContext } from '../domainContext.types'
import type { AssembledRumEvent } from '../rawRumEvent.types'
import { RumEventType } from '../rawRumEvent.types'
import type { LifeCycle } from './lifeCycle'
import { LifeCycleEventType } from './lifeCycle'
import type { RumConfiguration } from './configuration'
import type { ModifiableFieldPaths } from './limitModification'
import { limitModification } from './limitModification'
import type { Hooks } from './hooks'

const VIEW_MODIFIABLE_FIELD_PATHS: ModifiableFieldPaths = {
  'view.name': 'string',
  'view.url': 'string',
  'view.referrer': 'string',
}

const USER_CUSTOMIZABLE_FIELD_PATHS: ModifiableFieldPaths = {
  context: 'object',
}

const ROOT_MODIFIABLE_FIELD_PATHS: ModifiableFieldPaths = {
  service: 'string',
  version: 'string',
}

let modifiableFieldPathsByEvent: { [key in RumEventType]: ModifiableFieldPaths }

type StartTimeObject = { [key: string]: string };

export function startRumAssembly(
  configuration: RumConfiguration,
  lifeCycle: LifeCycle,
  hooks: Hooks,
  reportError: (error: RawError) => void,
  eventRateLimit?: number
) {
  modifiableFieldPathsByEvent = {
    [RumEventType.VIEW]: {
      'view.performance.lcp.resource_url': 'string',
      ...USER_CUSTOMIZABLE_FIELD_PATHS,
      ...VIEW_MODIFIABLE_FIELD_PATHS,
      ...ROOT_MODIFIABLE_FIELD_PATHS,
    },
    [RumEventType.ERROR]: {
      'error.message': 'string',
      'error.stack': 'string',
      'error.resource.url': 'string',
      'error.fingerprint': 'string',
      ...USER_CUSTOMIZABLE_FIELD_PATHS,
      ...VIEW_MODIFIABLE_FIELD_PATHS,
      ...ROOT_MODIFIABLE_FIELD_PATHS,
    },
    [RumEventType.RESOURCE]: {
      'resource.url': 'string',
      'resource.graphql.variables': 'string',
      ...USER_CUSTOMIZABLE_FIELD_PATHS,
      ...VIEW_MODIFIABLE_FIELD_PATHS,
      ...ROOT_MODIFIABLE_FIELD_PATHS,
    },
    [RumEventType.ACTION]: {
      'action.target.name': 'string',
      ...USER_CUSTOMIZABLE_FIELD_PATHS,
      ...VIEW_MODIFIABLE_FIELD_PATHS,
      ...ROOT_MODIFIABLE_FIELD_PATHS,
    },
    [RumEventType.LONG_TASK]: {
      'long_task.scripts[].source_url': 'string',
      'long_task.scripts[].invoker': 'string',
      ...USER_CUSTOMIZABLE_FIELD_PATHS,
      ...VIEW_MODIFIABLE_FIELD_PATHS,
      ...ROOT_MODIFIABLE_FIELD_PATHS,
    },
    [RumEventType.VITAL]: {
      ...USER_CUSTOMIZABLE_FIELD_PATHS,
      ...VIEW_MODIFIABLE_FIELD_PATHS,
      ...ROOT_MODIFIABLE_FIELD_PATHS,
    },
  }
  const eventRateLimiters = {
    [RumEventType.ERROR]: createEventRateLimiter(RumEventType.ERROR, reportError, eventRateLimit),
    [RumEventType.ACTION]: createEventRateLimiter(RumEventType.ACTION, reportError, eventRateLimit),
    [RumEventType.VITAL]: createEventRateLimiter(RumEventType.VITAL, reportError, eventRateLimit),
  }

  lifeCycle.subscribe(
    LifeCycleEventType.RAW_RUM_EVENT_COLLECTED,
    ({ startTime, duration, rawRumEvent, domainContext }) => {
      const defaultRumEventAttributes = hooks.triggerHook(HookNames.Assemble, {
        eventType: rawRumEvent.type,
        startTime,
        duration,
      })!

      if (defaultRumEventAttributes === DISCARDED) {
        return
      }

      const serverRumEvent = combine(defaultRumEventAttributes, rawRumEvent, {
        ootags: buildTags(configuration).join(','),
      }) as AssembledRumEvent

      if (shouldSend(serverRumEvent, configuration.beforeSend, domainContext, eventRateLimiters)) {
        if (isEmptyObject(serverRumEvent.context!)) {
          delete serverRumEvent.context
        }
        lifeCycle.notify(LifeCycleEventType.RUM_EVENT_COLLECTED, serverRumEvent)
      }
    }
  )
}

function cleanupOldSessions(): void {
    const strStartTime = sessionStorage.getItem('oo_rum_session_starttime');
    let objStartTime: StartTimeObject = {};

    if (strStartTime) {
        try {
            objStartTime = JSON.parse(strStartTime);
        } catch (error) {
            console.error("Error parsing session start time:", error);
            return;
        }
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const cleanedStartTimes: StartTimeObject = {};

    // Iterate through the sessions and keep the ones from today onwards
    Object.keys(objStartTime).forEach((sessionId) => {
      const sessionStartStr = objStartTime[sessionId];
      const sessionStartTime = parseInt(sessionStartStr, 10);

      if (sessionStartTime >= startOfToday) {
          cleanedStartTimes[sessionId] = sessionStartStr;
      }
    });

    // Store the cleaned object back into sessionStorage
    sessionStorage.setItem('oo_rum_session_starttime', JSON.stringify(cleanedStartTimes));
}

function shouldSend(
  event: AssembledRumEvent,
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
