import { useEffect, useState } from 'react'
import type { RumInternalContext, Context } from '@openobserve/browser-core'
import type { LogsInitConfiguration } from '@openobserve/browser-logs'
import type { RumInitConfiguration } from '@openobserve/browser-rum'
import { createLogger } from '../../common/logger'
import { evalInWindow } from '../evalInWindow'
import { computeLogsTrackingType, computeRumTrackingType } from '../sampler'

const logger = createLogger('useSdkInfos')

const REFRESH_INFOS_INTERVAL = 2000

export interface SdkInfos {
  rum?: {
    version?: string
    config?: RumInitConfiguration
    internalContext?: RumInternalContext
    globalContext?: Context
    user: Context
  }
  logs?: {
    version?: string
    config?: LogsInitConfiguration
    globalContext?: Context
    user: Context
  }
  cookie?: {
    id?: string
    created?: string
    expire?: string
    logs?: string
    rum?: string
    forcedReplay?: '1'
  }
  rumTrackingType?: string
  logsTrackingType?: string
}

export function useSdkInfos() {
  const [infos, setInfos] = useState<SdkInfos | undefined>()

  useEffect(() => {
    function refreshInfos() {
      void getInfos().then((newInfos) =>
        setInfos((previousInfos) => (deepEqual(previousInfos, newInfos) ? previousInfos : newInfos))
      )
    }
    refreshInfos()
    const id = setInterval(refreshInfos, REFRESH_INFOS_INTERVAL)
    return () => clearInterval(id)
  }, [])

  return infos
}

async function getInfos(): Promise<SdkInfos> {
  let raw: SdkInfos
  try {
    raw = (await evalInWindow(
      `
        // Helper to serialize objects while preserving function metadata
        function serializeWithFunctions(obj) {
          return JSON.parse(JSON.stringify(obj, function(key, value) {
            if (typeof value === 'function') {
              return {
                __type: 'function',
                __name: value.name || '(anonymous)',
                __source: value.toString()
              }
            }
            return value
          }))
        }

        const cookieRawValue = document.cookie
          .split(';')
          .map(cookie => cookie.match(/(\\S*?)=(.*)/)?.slice(1) || [])
          .find(([name, _]) => name === '_oo_s')
          ?.[1]

        const cookie = cookieRawValue && Object.fromEntries(
          cookieRawValue.split('&').map(value => value.split('='))
        )
        const rum = window.O2_RUM && {
          version: window.O2_RUM?.version,
          config: serializeWithFunctions(window.O2_RUM?.getInitConfiguration?.()),
          internalContext: window.O2_RUM?.getInternalContext?.(),
          globalContext: window.O2_RUM?.getGlobalContext?.(),
          user: window.O2_RUM?.getUser?.(),
        }
        const logs = window.O2_LOGS && {
          version: window.O2_LOGS?.version,
          config: serializeWithFunctions(window.O2_LOGS?.getInitConfiguration?.()),
          globalContext: window.O2_LOGS?.getGlobalContext?.(),
          user: window.O2_LOGS?.getUser?.(),
        }
        return { rum, logs, cookie }
      `
    )) as SdkInfos
  } catch (error) {
    logger.error('Error while getting SDK infos:', error)
    return {}
  }

  const sessionId = raw.cookie?.id
  return {
    ...raw,
    rumTrackingType:
      (raw.cookie?.rum ?? (sessionId && raw.rum?.config && computeRumTrackingType(sessionId, raw.rum.config))) ||
      undefined,
    logsTrackingType:
      (raw.cookie?.logs ?? (sessionId && raw.logs?.config && computeLogsTrackingType(sessionId, raw.logs.config))) ||
      undefined,
  }
}

function deepEqual(a: unknown, b: unknown) {
  // Quick and dirty but does the job. We might want to include a cleaner helper if our needs are
  // changing.
  return JSON.stringify(a) === JSON.stringify(b)
}
