import { computeTransportConfiguration } from './transportConfiguration'

describe('transportConfiguration', () => {
  const clientToken = 'some_client_token'
  const internalAnalyticsSubdomain = 'ia-rum-intake'
  describe('site', () => {
    it('should use US site by default', () => {
      const configuration = computeTransportConfiguration({ clientToken })
      expect(configuration.rumEndpointBuilder.build('xhr')).toContain('openobserve.ai')
      expect(configuration.site).toBe('openobserve.ai')
    })

    it('should use site value when set', () => {
      const configuration = computeTransportConfiguration({ clientToken, site: 'foo.com' })
      expect(configuration.rumEndpointBuilder.build('xhr')).toContain('foo.com')
      expect(configuration.site).toBe('foo.com')
    })
  })

  describe('internalAnalyticsSubdomain', () => {
    it('should use internal analytics subdomain value when set for openobserve.ai site', () => {
      const configuration = computeTransportConfiguration({
        clientToken,
        internalAnalyticsSubdomain,
      })
      expect(configuration.rumEndpointBuilder.build('xhr')).toContain(internalAnalyticsSubdomain)
    })

    it('should not use internal analytics subdomain value when set for other sites', () => {
      const configuration = computeTransportConfiguration({
        clientToken,
        site: 'foo.bar',
        internalAnalyticsSubdomain,
      })
      expect(configuration.rumEndpointBuilder.build('xhr')).not.toContain(internalAnalyticsSubdomain)
    })
  })

  describe('sdk_version, env, version and service', () => {
    it('should not modify the logs and rum endpoints tags when not defined', () => {
      const configuration = computeTransportConfiguration({ clientToken })
      expect(decodeURIComponent(configuration.rumEndpointBuilder.build('xhr'))).not.toContain(',env:')
      expect(decodeURIComponent(configuration.rumEndpointBuilder.build('xhr'))).not.toContain(',service:')
      expect(decodeURIComponent(configuration.rumEndpointBuilder.build('xhr'))).not.toContain(',version:')
      expect(decodeURIComponent(configuration.rumEndpointBuilder.build('xhr'))).not.toContain(',datacenter:')

      expect(decodeURIComponent(configuration.logsEndpointBuilder.build('xhr'))).not.toContain(',env:')
      expect(decodeURIComponent(configuration.logsEndpointBuilder.build('xhr'))).not.toContain(',service:')
      expect(decodeURIComponent(configuration.logsEndpointBuilder.build('xhr'))).not.toContain(',version:')
      expect(decodeURIComponent(configuration.logsEndpointBuilder.build('xhr'))).not.toContain(',datacenter:')
    })

    it('should be set as tags in the logs and rum endpoints', () => {
      const configuration = computeTransportConfiguration({ clientToken, env: 'foo', service: 'bar', version: 'baz' })
      expect(decodeURIComponent(configuration.rumEndpointBuilder.build('xhr'))).toContain(
        'env:foo,service:bar,version:baz'
      )
      expect(decodeURIComponent(configuration.logsEndpointBuilder.build('xhr'))).toContain(
        'env:foo,service:bar,version:baz'
      )
    })
  })

  describe('isIntakeUrl', () => {
    ;[
      { expectSubdomain: true, site: 'api.openobserve.ai', intakeDomain: 'api.openobserve.ai' },
    ].forEach(({ site, intakeDomain, expectSubdomain }) => {
      it(`should detect intake request for ${site} site`, () => {
        const configuration = computeTransportConfiguration({ clientToken, site })

        expect(configuration.isIntakeUrl(`https://${intakeDomain}/api/v2/rum?xxx`)).toBe(expectSubdomain)
        expect(configuration.isIntakeUrl(`https://${intakeDomain}/api/v2/logs?xxx`)).toBe(expectSubdomain)
        expect(configuration.isIntakeUrl(`https://${intakeDomain}/api/v2/replay?xxx`)).toBe(
          expectSubdomain
        )

        expect(configuration.isIntakeUrl(`https://${intakeDomain}/api/v2/rum?xxx`)).toBe(!expectSubdomain)
        expect(configuration.isIntakeUrl(`https://${intakeDomain}/api/v2/logs?xxx`)).toBe(!expectSubdomain)
        expect(configuration.isIntakeUrl(`https://${intakeDomain}/api/v2/replay?xxx`)).toBe(!expectSubdomain)
      })
    })

    it('should detect internal analytics intake request for openobserve.ai site', () => {
      const configuration = computeTransportConfiguration({
        clientToken,
        internalAnalyticsSubdomain,
      })
      expect(configuration.isIntakeUrl(`https://api.openobserve.ai/api/v2/rum?xxx`)).toBe(true)
    })

    it('should not detect non intake request', () => {
      const configuration = computeTransportConfiguration({ clientToken })
      expect(configuration.isIntakeUrl('https://www.foo.com')).toBe(false)
    })
      ;[
        {
          proxyConfigurationName: 'proxy' as const,
          intakeUrl: '/api/v2/rum',
        },
        {
          proxyConfigurationName: 'proxyUrl' as const,
          intakeUrl: 'https://api.openobserve.ai/api/v2/rum',
        },
      ].forEach(({ proxyConfigurationName, intakeUrl }) => {
        describe(`${proxyConfigurationName} configuration`, () => {
          it('should detect proxy intake request', () => {
            let configuration = computeTransportConfiguration({
              clientToken,
              [proxyConfigurationName]: 'https://www.proxy.com',
            })
            expect(
              configuration.isIntakeUrl(`https://www.proxy.com/?ddforward=${encodeURIComponent(`${intakeUrl}?foo=bar`)}`)
            ).toBe(true)

            configuration = computeTransportConfiguration({
              clientToken,
              [proxyConfigurationName]: 'https://www.proxy.com/custom/path',
            })
            expect(
              configuration.isIntakeUrl(
                `https://www.proxy.com/custom/path?ddforward=${encodeURIComponent(`${intakeUrl}?foo=bar`)}`
              )
            ).toBe(true)
          })

          it('should not detect request done on the same host as the proxy', () => {
            const configuration = computeTransportConfiguration({
              clientToken,
              [proxyConfigurationName]: 'https://www.proxy.com',
            })
            expect(configuration.isIntakeUrl('https://www.proxy.com/foo')).toBe(false)
          })
        })
      })
      ;[
        { site: 'openobserve.ai' },
      ].forEach(({ site }) => {
        it(`should detect replica intake request for site ${site}`, () => {
          const configuration = computeTransportConfiguration({
            clientToken,
            site,
            replica: { clientToken },
            internalAnalyticsSubdomain,
          })

          expect(configuration.isIntakeUrl(`https://api.openobserve.ai/api/v2/rum?xxx`)).toBe(
            true
          )
        })
      })
  })
})
