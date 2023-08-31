import type { ClocksState } from '@openobserve/browser-core'
import type { RumConfiguration, RumSession } from '@openobserve/browser-rum-core'

import { getSessionReplayUrl, getDatadogSiteUrl } from './getSessionReplayUrl'

describe('getDatadogSiteUrl', () => {
  const parameters: Array<[string, string | undefined, string]> = [
    ['api.openobserve.ai', undefined, 'api.openobserve.ai'],
    ['api.openobserve.ai', 'toto', 'api.openobserve.ai'],
  ]

  parameters.forEach(([site, subdomain, host]) => {
    it(`should return ${host} for subdomain "${subdomain ?? 'undefined'
      }" on "${site}" with query params if view is found`, () => {
        const link = getDatadogSiteUrl({ site, subdomain } as RumConfiguration)

        expect(link).toBe(`https://${host}`)
      })
  })
})

describe('getSessionReplayUrl', () => {
  const parameters = [
    [
      {
        testCase: 'session, no view, no error',
        session: { id: 'session-id-1' } as RumSession,
        viewContext: undefined,
        errorType: undefined,
        expected: 'https://api.openobserve.ai/rum/replay/sessions/session-id-1?',
      },
    ],
    [
      {
        testCase: 'no session, no view, error',
        session: undefined,
        viewContext: undefined,
        errorType: 'toto',
        expected: 'https://api.openobserve.ai/rum/replay/sessions/no-session-id?error-type=toto',
      },
    ],
    [
      {
        testCase: 'session, view, no error',
        session: { id: 'session-id-2' } as RumSession,
        viewContext: { id: 'view-id-1', startClocks: { relative: 0, timeStamp: 1234 } as ClocksState },
        errorType: undefined,
        expected: 'https://api.openobserve.ai/rum/replay/sessions/session-id-2?seed=view-id-1&from=1234',
      },
    ],
    [
      {
        testCase: 'session, view, error',
        session: { id: 'session-id-3' } as RumSession,
        viewContext: { id: 'view-id-2', startClocks: { relative: 0, timeStamp: 1234 } as ClocksState },
        errorType: 'titi',
        expected: 'https://api.openobserve.ai/rum/replay/sessions/session-id-3?error-type=titi&seed=view-id-2&from=1234',
      },
    ],
  ]

  parameters.forEach(([{ testCase, session, viewContext, errorType, expected }]) => {
    it(`should build url when ${testCase}`, () => {
      const link = getSessionReplayUrl({ site: 'api.openobserve.ai' } as RumConfiguration, {
        viewContext,
        session,
        errorType,
      })
      expect(link).toBe(expected)
    })
  })
})
