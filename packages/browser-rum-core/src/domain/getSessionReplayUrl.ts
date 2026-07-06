import type { SessionContext } from '@openobserve/browser-core'
import type { RumConfiguration } from './configuration'
import type { ViewHistoryEntry } from './contexts/viewHistory'

export function getSessionReplayUrl(
  configuration: RumConfiguration,
  {
    session,
    viewContext,
    errorType,
  }: {
    session?: SessionContext
    viewContext?: ViewHistoryEntry
    errorType?: string
  }
): string {
  const sessionId = session ? session.id : 'no-session-id'
  const parameters: string[] = []
  if (errorType !== undefined) {
    parameters.push(`error-type=${errorType}`)
  }
  if (viewContext) {
    parameters.push(`seed=${viewContext.id}`)
    parameters.push(`from=${viewContext.startClocks.timeStamp}`)
  }

  const origin = getDatadogSiteUrl(configuration)
  const path = `/rum/replay/sessions/${sessionId}`
  return `${origin}${path}?${parameters.join('&')}`
}

export function getDatadogSiteUrl(rumConfiguration: RumConfiguration) {
  const site = rumConfiguration.site
  const subdomain = rumConfiguration.subdomain || getSiteDefaultSubdomain(rumConfiguration)
  return `https://${subdomain ? `${subdomain}.` : ''}${site}`
}

function getSiteDefaultSubdomain(_configuration: RumConfiguration): string | undefined {
  // OpenObserve: the configured site is the full console host, no subdomain is prepended.
  return undefined
}
