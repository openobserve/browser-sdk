/**
 * Entry point consumed by the Openobserve Web app to mutualize some types, constant and logic for
 * tests.
 *
 * WARNING: this module is not intended for public usages, and won't follow semver for breaking
 * changes.
 */
export type { TimeStamp } from '@openobserve/browser-core'
export {
  PRIVACY_ATTR_NAME,
  PRIVACY_ATTR_VALUE_HIDDEN,
  PRIVACY_CLASS_PREFIX,
  NodePrivacyLevel,
} from '@openobserve/browser-rum-core'

export * from '../types'

export { serializeNodeWithId } from '../domain/record'
