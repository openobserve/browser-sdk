import { getCookie } from '../../browser/cookie'

export const SYNTHETICS_TEST_ID_COOKIE_NAME = 'openobserve-synthetics-public-id'
export const SYNTHETICS_RESULT_ID_COOKIE_NAME = 'openobserve-synthetics-result-id'
export const SYNTHETICS_INJECTS_RUM_COOKIE_NAME = 'openobserve-synthetics-injects-rum'

export interface BrowserWindow extends Window {
  _OO_SYNTHETICS_PUBLIC_ID?: unknown
  _OO_SYNTHETICS_RESULT_ID?: unknown
  _OO_SYNTHETICS_INJECTS_RUM?: unknown
}

export function willSyntheticsInjectRum(): boolean {
  return Boolean(
    (window as BrowserWindow)._OO_SYNTHETICS_INJECTS_RUM || getCookie(SYNTHETICS_INJECTS_RUM_COOKIE_NAME)
  )
}

export function getSyntheticsTestId(): string | undefined {
  const value = (window as BrowserWindow)._OO_SYNTHETICS_PUBLIC_ID || getCookie(SYNTHETICS_TEST_ID_COOKIE_NAME)
  return typeof value === 'string' ? value : undefined
}

export function getSyntheticsResultId(): string | undefined {
  const value = (window as BrowserWindow)._OO_SYNTHETICS_RESULT_ID || getCookie(SYNTHETICS_RESULT_ID_COOKIE_NAME)
  return typeof value === 'string' ? value : undefined
}
