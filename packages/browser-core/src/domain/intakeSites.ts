import { normalizeUrl } from '../tools/utils/urlPolyfill'

export type Site =
  | 'datadoghq.com'
  | 'us3.datadoghq.com'
  | 'us5.datadoghq.com'
  | 'datadoghq.eu'
  | 'ddog-gov.com'
  | 'us2.ddog-gov.com'
  | 'ap1.datadoghq.com'
  | 'ap2.datadoghq.com'
  | (string & {})

export const INTAKE_SITE_STAGING: Site = 'datad0g.com'
export const INTAKE_SITE_US1: Site = 'datadoghq.com'
export const INTAKE_SITE_EU1: Site = 'datadoghq.eu'
export const INTAKE_SITE_US1_FED: Site = 'ddog-gov.com'
export const INTAKE_SITE_US2_FED: Site = 'us2.ddog-gov.com'

export const INTAKE_URL_PARAMETERS = ['o2source', 'o2-api-key', 'o2-request-id']

/**
 * URLs (without query string and fragment) built by a function-form `proxy`. The function is free to
 * rewrite the URL, so the intake parameters cannot be relied upon to recognize those requests.
 */
const proxiedIntakeUrls = new Set<string>()

/**
 * Safety net: a `proxy` function returning a different path for each request must not grow the set
 * indefinitely. Beyond this limit, new URLs are not registered.
 */
export const MAX_PROXIED_INTAKE_URLS = 100

function stripQueryAndHash(url: string) {
  return url.split(/[?#]/, 1)[0]
}

/**
 * Remember a URL produced by a function-form `proxy`, so that `isIntakeUrl` recognizes the requests
 * sent to it, whichever parameters the function kept, renamed or dropped.
 */
export function registerProxiedIntakeUrl(url: string) {
  if (proxiedIntakeUrls.size >= MAX_PROXIED_INTAKE_URLS) {
    return
  }
  try {
    proxiedIntakeUrls.add(stripQueryAndHash(normalizeUrl(url)))
  } catch {
    // The proxy function returned something that is not a valid URL: nothing to register
  }
}

export function resetProxiedIntakeUrls() {
  proxiedIntakeUrls.clear()
}

export function isIntakeUrl(url: string): boolean {
  // check if tags is present in the query string
  return (
    INTAKE_URL_PARAMETERS.every((param) => url.includes(param)) ||
    (proxiedIntakeUrls.size > 0 && proxiedIntakeUrls.has(stripQueryAndHash(url)))
  )
}
