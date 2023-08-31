import type { RumConfiguration } from '@openobserve/browser-rum-core'
import { getSessionReplayLink } from './getSessionReplayLink'

const DEFAULT_CONFIGURATION = {
  site: 'api.openobserve.ai',
} as RumConfiguration

describe('getReplayLink (slim package)', () => {
  it('should return the replay link with a "slim-package" error type', () => {
    const link = getSessionReplayLink(DEFAULT_CONFIGURATION)

    expect(link).toBe('https://api.openobserve.ai/rum/replay/sessions/no-session-id?error-type=slim-package')
  })
})
