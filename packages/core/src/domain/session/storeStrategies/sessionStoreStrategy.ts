import type { CookieOptions } from '../../../browser/cookie'
import type { SessionState } from '../sessionState'

export const SESSION_STORE_KEY = '_oo_s'

export type SessionStoreStrategyType = { type: 'Cookie'; cookieOptions: CookieOptions } | { type: 'LocalStorage' }

export interface SessionStoreStrategy {
  persistSession: (session: SessionState) => void
  retrieveSession: () => SessionState
  clearSession: () => void
}
