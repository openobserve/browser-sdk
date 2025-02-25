import { useEffect, useState } from 'react'
import { createLogger } from '../../common/logger'
import { evalInWindow } from '../evalInWindow'

const logger = createLogger('useSdkInfos')

const REFRESH_INFOS_INTERVAL = 2000

interface SdkInfos {
  rum?: {
    version?: string
    config?: object & { site?: string }
    internalContext?: object & { session: { id: string } }
    globalContext?: object
    user: object
  }
  logs?: {
    version?: string
    config?: object & { site?: string }
    globalContext?: object
    user: object
  }
  cookie?: {
    id: string
    created: string
    expire: string
    logs: string
    rum: string
  }
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
  try {
    return (await evalInWindow(
      `
        const cookieRawValue = document.cookie
          .split(';')
          .map(cookie => cookie.match(/(\\S*?)=(.*)/)?.slice(1) || [])
          .find(([name, _]) => name === '_oo_s')
          ?.[1]

        const cookie = cookieRawValue && Object.fromEntries(
          cookieRawValue.split('&').map(value => value.split('='))
        )
        const rum = window.OO_RUM && {
          version: window.OO_RUM?.version,
          config: window.OO_RUM?.getInitConfiguration?.(),
          internalContext: window.OO_RUM?.getInternalContext?.(),
          globalContext: window.OO_RUM?.getRumGlobalContext?.(),
          user: window.OO_RUM?.getUser?.(),
        }
        const logs = window.OO_LOGS && {
          version: window.OO_LOGS?.version,
          config: window.OO_LOGS?.getInitConfiguration?.(),
          globalContext: window.OO_LOGS?.getLoggerGlobalContext?.(),
          user: window.OO_LOGS?.getUser?.(),
        }
        return { rum, logs, cookie }
      `
    )) as SdkInfos
  } catch (error) {
    logger.error('Error while getting SDK infos:', error)
  }
  return {}
}

function deepEqual(a: unknown, b: unknown) {
  // Quick and dirty but does the job. We might want to include a cleaner helper if our needs are
  // changing.
  return JSON.stringify(a) === JSON.stringify(b)
}
