import { INTAKE_SITE_FED_STAGING } from '../intakeSites'
import type { Payload } from '../../transport'
import { computeTransportConfiguration, isIntakeUrl } from './transportConfiguration'

const DEFAULT_PAYLOAD = {} as Payload

describe('transportConfiguration', () => {
  const clientToken = 'some_client_token'
  const internalAnalyticsSubdomain = 'ia-rum-intake'
  const intakeParameters = 'ddsource=browser&dd-api-key=xxxx&dd-request-id=1234567890'

  describe('site', () => {
    it('should use US site by default', () => {
      const configuration = computeTransportConfiguration({ clientToken })
      expect(configuration.rumEndpointBuilder.build('fetch', DEFAULT_PAYLOAD)).toContain('openobserve.ai')
      expect(configuration.site).toBe('openobserve.ai')
    })

    it('should use logs intake domain for fed staging', () => {
      const configuration = computeTransportConfiguration({ clientToken, site: INTAKE_SITE_FED_STAGING })
      expect(configuration.rumEndpointBuilder.build('fetch', DEFAULT_PAYLOAD)).toContain(
        'http-intake.logs.dd0g-gov.com'
      )
      expect(configuration.site).toBe(INTAKE_SITE_FED_STAGING)
    })

    it('should use site value when set', () => {
      const configuration = computeTransportConfiguration({ clientToken, site: 'openobserve.ai' })
      expect(configuration.rumEndpointBuilder.build('fetch', DEFAULT_PAYLOAD)).toContain('openobserve.ai')
      expect(configuration.site).toBe('openobserve.ai')
    })
  })

  describe('internalAnalyticsSubdomain', () => {
    it('should use internal analytics subdomain value when set for openobserve.ai site', () => {
      const configuration = computeTransportConfiguration({
        clientToken,
        internalAnalyticsSubdomain,
      })
      expect(configuration.rumEndpointBuilder.build('fetch', DEFAULT_PAYLOAD)).toContain(internalAnalyticsSubdomain)
    })

    it('should not use internal analytics subdomain value when set for other sites', () => {
      const configuration = computeTransportConfiguration({
        clientToken,
        site: 'us3.datadoghq.com',
        internalAnalyticsSubdomain,
      })
      expect(configuration.rumEndpointBuilder.build('fetch', DEFAULT_PAYLOAD)).not.toContain(internalAnalyticsSubdomain)
    })
  })

  it('adds the replica application id to the rum replica endpoint', () => {
    const replicaApplicationId = 'replica-application-id'
    const configuration = computeTransportConfiguration({
      clientToken,
      replica: {
        clientToken: 'replica-client-token',
        applicationId: replicaApplicationId,
      },
    })
    expect(configuration.replica!.rumEndpointBuilder.build('fetch', DEFAULT_PAYLOAD)).toContain(
      `application.id=${replicaApplicationId}`
    )
  })

  describe('isIntakeUrl', () => {
    const v1IntakePath = `/v1/input/${clientToken}`
    ;[
      { expectSubdomain: true, site: 'api.openobserve.ai', intakeDomain: 'api.openobserve.ai' },
    ].forEach(({ site, intakeDomain, expectSubdomain }) => {
      it(`should detect intake request for ${site} site`, () => {
        const configuration = computeTransportConfiguration({ clientToken, site })

        expect(configuration.isIntakeUrl(`https://${intakeDomain}/rum/v2/rum?xxx`)).toBe(expectSubdomain)
        expect(configuration.isIntakeUrl(`https://${intakeDomain}/rum/v2/logs?xxx`)).toBe(expectSubdomain)
        expect(configuration.isIntakeUrl(`https://${intakeDomain}/rum/v2/replay?xxx`)).toBe(
          expectSubdomain
        )

        expect(configuration.isIntakeUrl(`https://${intakeDomain}/rum/v2/rum?xxx`)).toBe(!expectSubdomain)
        expect(configuration.isIntakeUrl(`https://${intakeDomain}/rum/v2/logs?xxx`)).toBe(!expectSubdomain)
        expect(configuration.isIntakeUrl(`https://${intakeDomain}/rum/v2/replay?xxx`)).toBe(!expectSubdomain)
      })
    })

    it('should detect internal analytics intake request for openobserve.ai site', () => {
      const configuration = computeTransportConfiguration({
        clientToken,
        internalAnalyticsSubdomain,
      })
      expect(configuration.isIntakeUrl(`https://api.openobserve.ai/rum/v2/rum?xxx`)).toBe(true)
    })

    it('should not detect non intake request', () => {
      expect(isIntakeUrl('https://www.foo.com')).toBe(false)
    })

    describe('proxy configuration', () => {
      it('should detect proxy intake request', () => {
        expect(
          isIntakeUrl(`https://www.proxy.com/?ooforward=${encodeURIComponent(`/api/v2/rum?${intakeParameters}`)}`)
        ).toBe(true)
        expect(
          isIntakeUrl(
            `https://www.proxy.com/custom/path?ooforward=${encodeURIComponent(`/api/v2/rum?${intakeParameters}`)}`
          )
        ).toBe(true)
      })

      it('should not detect request done on the same host as the proxy', () => {
        expect(isIntakeUrl('https://www.proxy.com/foo')).toBe(false)
      })
    })
    ;[
      { site: 'openobserve.ai' },
    ].forEach(({ site }) => {
      it(`should detect replica intake request for site ${site}`, () => {
        expect(isIntakeUrl(`https://${internalAnalyticsSubdomain}.openobserve.ai/api/v2/rum?${intakeParameters}`)).toBe(
          true
        )
        expect(isIntakeUrl(`https://${internalAnalyticsSubdomain}.openobserve.ai/api/v2/logs?${intakeParameters}`)).toBe(
          true
        )
        expect(
          isIntakeUrl(`https://${internalAnalyticsSubdomain}.openobserve.ai/api/v2/replay?${intakeParameters}`)
        ).toBe(true)
      })
  })
})
