import { getInitCookie } from '../../browser/cookie'
import { globalObject, isWorkerEnvironment } from '../../tools/globalObject'

export const SYNTHETICS_TEST_ID_COOKIE_NAME = 'openobserve-synthetics-public-id'
export const SYNTHETICS_RESULT_ID_COOKIE_NAME = 'openobserve-synthetics-result-id'
export const SYNTHETICS_INJECTS_RUM_COOKIE_NAME = 'openobserve-synthetics-injects-rum'

export interface BrowserWindow extends Window {
  _OO_SYNTHETICS_PUBLIC_ID?: unknown
  _OO_SYNTHETICS_RESULT_ID?: unknown
  _OO_SYNTHETICS_INJECTS_RUM?: unknown
}

export function willSyntheticsInjectRum(): boolean {
  if (isWorkerEnvironment) {
    // We don't expect to run synthetics tests in a worker environment
    return false
  }

  return Boolean(
    (globalObject as BrowserWindow)._OO_SYNTHETICS_INJECTS_RUM || getInitCookie(SYNTHETICS_INJECTS_RUM_COOKIE_NAME)
  )
}

export function getSyntheticsTestId(): string | undefined {
  const value = (window as BrowserWindow)._OO_SYNTHETICS_PUBLIC_ID || getInitCookie(SYNTHETICS_TEST_ID_COOKIE_NAME)
  return typeof value === 'string' ? value : undefined
}

export function getSyntheticsResultId(): string | undefined {
  const value =
    (window as BrowserWindow)._OO_SYNTHETICS_RESULT_ID || getInitCookie(SYNTHETICS_RESULT_ID_COOKIE_NAME)
  return typeof value === 'string' ? value : undefined
}

export function isSyntheticsTest(): boolean {
  return Boolean(getSyntheticsTestId() && getSyntheticsResultId())
}
