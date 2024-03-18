import { INTAKE_SITE_STAGING, INTAKE_SITE_US1, INTAKE_SITE_EU1, createContextManager, monitor } from '@openobserve/browser-core'
import type { RumConfiguration } from './configuration'
import type { ViewContext } from './contexts/viewContexts'
import type { RumSession } from './rumSessionManager'

export function getSessionReplayUrl(
  configuration: RumConfiguration,
  {
    session,
    viewContext,
    errorType,
  }: {
    session?: RumSession
    viewContext?: ViewContext
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

  var userContextManager = createContextManager("user" /* CustomerDataType.User */);
  var userDetail = monitor(userContextManager.getContext);
  console.log(userDetail);
  return `${origin}${path}?${parameters.join('&')&usr_email=userDetail.email}`
}

export function getDatadogSiteUrl(rumConfiguration: RumConfiguration) {
  const site = rumConfiguration.site
  const subdomain = rumConfiguration.subdomain || getSiteDefaultSubdomain(rumConfiguration)
  return `https://${subdomain ? `${subdomain}.` : ''}${site}`
}

function getSiteDefaultSubdomain(configuration: RumConfiguration): string | undefined {
  switch (configuration.site) {
    case INTAKE_SITE_US1:
    case INTAKE_SITE_EU1:
      return ''
    case INTAKE_SITE_STAGING:
      return ''
    default:
      return undefined
  }
}
