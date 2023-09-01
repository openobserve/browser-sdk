import { isIE } from '@openobserve/browser-core'
import type { RumConfiguration, ViewContexts } from '@openobserve/browser-rum-core'
import { createRumSessionManagerMock } from '../../../rum-core/test'
import { getSessionReplayLink } from './getSessionReplayLink'
import { addRecord, resetReplayStats } from './replayStats'

const DEFAULT_CONFIGURATION = {
  site: 'api.openobserve.ai',
} as RumConfiguration

describe('getReplayLink', () => {
  afterEach(() => {
    resetReplayStats()
  })
  it('should return url without query param if no view', () => {
    const sessionManager = createRumSessionManagerMock().setId('session-id-1')
    const viewContexts = { findView: () => undefined } as ViewContexts

    const link = getSessionReplayLink(DEFAULT_CONFIGURATION, sessionManager, viewContexts, true)

    expect(link).toBe(
      isIE()
        ? 'https://api.openobserve.ai/rum/replay/sessions/session-id-1?error-type=browser-not-supported'
        : 'https://api.openobserve.ai/rum/replay/sessions/session-id-1?'
    )
  })

  it('should return the replay link', () => {
    const sessionManager = createRumSessionManagerMock().setId('session-id-1')
    const viewContexts = {
      findView: () => ({
        id: 'view-id-1',
        startClocks: {
          timeStamp: 123456,
        },
      }),
    } as ViewContexts
    addRecord('view-id-1')

    const link = getSessionReplayLink(
      { ...DEFAULT_CONFIGURATION, site: 'api.openobserve.ai', subdomain: '' },
      sessionManager,
      viewContexts,
      true
    )

    expect(link).toBe(
      isIE()
        ? 'https://api.openobserve.ai/rum/replay/sessions/session-id-1?error-type=browser-not-supported&seed=view-id-1&from=123456'
        : 'https://api.openobserve.ai/rum/replay/sessions/session-id-1?seed=view-id-1&from=123456'
    )
  })

  it('return a param if replay is sampled out', () => {
    const sessionManager = createRumSessionManagerMock().setId('session-id-1').setPlanWithoutSessionReplay()
    const viewContexts = {
      findView: () => ({
        id: 'view-id-1',
        startClocks: {
          timeStamp: 123456,
        },
      }),
    } as ViewContexts

    const link = getSessionReplayLink(
      { ...DEFAULT_CONFIGURATION, site: 'api.openobserve.ai' },
      sessionManager,
      viewContexts,
      true
    )
    const errorType = isIE() ? 'browser-not-supported' : 'incorrect-session-plan'
    expect(link).toBe(
      `https://api.openobserve.ai/rum/replay/sessions/session-id-1?error-type=${errorType}&seed=view-id-1&from=123456`
    )
  })

  it('return a param if rum is sampled out', () => {
    const sessionManager = createRumSessionManagerMock().setNotTracked()
    const viewContexts = {
      findView: () => undefined,
    } as ViewContexts

    const link = getSessionReplayLink(
      { ...DEFAULT_CONFIGURATION, site: 'api.openobserve.ai' },
      sessionManager,
      viewContexts,
      true
    )

    const errorType = isIE() ? 'browser-not-supported' : 'rum-not-tracked'
    expect(link).toBe(`https://api.openobserve.ai/rum/replay/sessions/no-session-id?error-type=${errorType}`)
  })

  it('should add a param if the replay was not started', () => {
    const sessionManager = createRumSessionManagerMock().setId('session-id-1')
    const viewContexts = {
      findView: () => ({
        id: 'view-id-1',
        startClocks: {
          timeStamp: 123456,
        },
      }),
    } as ViewContexts

    const link = getSessionReplayLink(
      { ...DEFAULT_CONFIGURATION, site: 'api.openobserve.ai' },
      sessionManager,
      viewContexts,
      false
    )

    const errorType = isIE() ? 'browser-not-supported' : 'replay-not-started'
    expect(link).toBe(
      `https://api.openobserve.ai/rum/replay/sessions/session-id-1?error-type=${errorType}&seed=view-id-1&from=123456`
    )
  })
})
