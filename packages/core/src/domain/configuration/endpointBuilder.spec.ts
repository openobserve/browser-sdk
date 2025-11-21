import type { Payload } from '../../transport'
import type { InitConfiguration } from './configuration'
import { createEndpointBuilder } from './endpointBuilder'

const DEFAULT_PAYLOAD = {} as Payload

describe('endpointBuilder', () => {
  const clientToken = 'some_client_token'
  let initConfiguration: InitConfiguration

  beforeEach(() => {
    initConfiguration = { clientToken, apiVersion: 'v1', organizationIdentifier: 'xyz', insecureHTTP: false }
  })

  describe('query parameters', () => {
    it('should add intake query parameters', () => {
      expect(createEndpointBuilder(initConfiguration, 'rum').build('fetch', DEFAULT_PAYLOAD)).toMatch(
        `&o2-api-key=${clientToken}&o2-evp-origin-version=(.*)&o2-evp-origin=browser&o2-request-id=(.*)`
      )
    })

    it('should add batch_time for rum endpoint', () => {
      expect(createEndpointBuilder(initConfiguration, 'rum').build('fetch', DEFAULT_PAYLOAD)).toContain('&batch_time=')
    })

    it('should not add batch_time for logs and replay endpoints', () => {
      expect(createEndpointBuilder(initConfiguration, 'logs').build('fetch', DEFAULT_PAYLOAD)).not.toContain(
        '&batch_time='
      )
      expect(createEndpointBuilder(initConfiguration, 'replay').build('fetch', DEFAULT_PAYLOAD)).not.toContain(
        '&batch_time='
      )
    })

    it('should add the provided encoding', () => {
      expect(
        createEndpointBuilder(initConfiguration, 'rum').build('fetch', { ...DEFAULT_PAYLOAD, encoding: 'deflate' })
      ).toContain('&dd-evp-encoding=deflate')
    })

    it('should not start with o2source for internal analytics mode', () => {
      const url = createEndpointBuilder({ ...initConfiguration, internalAnalyticsSubdomain: 'foo' }, 'rum').build(
        'fetch',
        DEFAULT_PAYLOAD
      )
      expect(url).not.toContain('/rum?o2source')
      expect(url).toContain('o2source=browser')
    })

    it('accepts extra parameters', () => {
      const extraParameters = ['application.id=1234', 'application.version=1.0.0']
      const url = createEndpointBuilder(initConfiguration, 'rum', extraParameters).build('fetch', DEFAULT_PAYLOAD)
      expect(url).toContain('application.id=1234')
      expect(url).toContain('application.version=1.0.0')
    })
  })

  describe('proxy configuration', () => {
    it('should replace the intake endpoint by the proxy and set the intake path and parameters in the attribute ooforward', () => {
      expect(
        createEndpointBuilder({ ...initConfiguration, proxy: 'https://proxy.io/path' }, 'rum').build(
          'fetch',
          DEFAULT_PAYLOAD
        )
      ).toMatch(
        `https://proxy.io/path\\?ooforward=${encodeURIComponent(
          `/rum/v2/rum?o2source=(.*)&o2-api-key=${clientToken}` +
            '&o2-evp-origin-version=(.*)&o2-evp-origin=browser&o2-request-id=(.*)&batch_time=(.*)'
        )}`
      )
    })

    it('normalizes the proxy url', () => {
      const endpoint = createEndpointBuilder({ ...initConfiguration, proxy: '/path' }, 'rum').build(
        'fetch',
        DEFAULT_PAYLOAD
      )
      expect(endpoint.startsWith(`${location.origin}/path?ooforward`)).toBeTrue()
    })

    it('should allow to fully control the proxy url', () => {
      const proxyFn = (options: { path: string; parameters: string }) =>
        `https://proxy.io/prefix${options.path}/suffix?${options.parameters}`
      expect(
        createEndpointBuilder({ ...initConfiguration, proxy: proxyFn }, 'rum').build('fetch', DEFAULT_PAYLOAD)
      ).toMatch(
        `https://proxy.io/prefix/api/v2/rum/suffix\\?oosource=(.*)&o2-api-key=${clientToken}&o2-evp-origin-version=(.*)&o2-evp-origin=browser&o2-request-id=(.*)&batch_time=(.*)`
      )
    })
  })

  describe('_o2 attributes', () => {
    it('should contain api', () => {
      expect(createEndpointBuilder(initConfiguration, 'rum').build('fetch', DEFAULT_PAYLOAD)).toContain('_o2.api=fetch')
    })

    it('should contain retry infos', () => {
      expect(
        createEndpointBuilder(initConfiguration, 'rum').build('fetch', {
          ...DEFAULT_PAYLOAD,
          retry: {
            count: 5,
            lastFailureStatus: 408,
          },
        })
      ).toContain('_dd.retry_count=5&_dd.retry_after=408')
    })

    it('should not contain any _dd attributes for non rum endpoints', () => {
      expect(
        createEndpointBuilder(initConfiguration, 'logs').build('fetch', {
          ...DEFAULT_PAYLOAD,
          retry: {
            count: 5,
            lastFailureStatus: 408,
          },
        })
      ).not.toContain('_o2.api=fetch&_o2.retry_count=5&_o2.retry_after=408')
    })
  })

  describe('PCI compliance intake with option', () => {
    it('should return PCI compliance intake endpoint if site is us1', () => {
      const config: InitConfiguration & { usePciIntake?: boolean } = {
        clientToken,
        usePciIntake: true,
        site: 'datadoghq.com',
      }
      expect(createEndpointBuilder(config, 'logs').build('fetch', DEFAULT_PAYLOAD)).toContain(
        'https://pci.browser-intake-datadoghq.com'
      )
    })
    it('should not return PCI compliance intake endpoint if site is not us1', () => {
      const config: InitConfiguration & { usePciIntake?: boolean } = {
        clientToken,
        usePciIntake: true,
        site: 'ap1.datadoghq.com',
      }
      expect(createEndpointBuilder(config, 'logs').build('fetch', DEFAULT_PAYLOAD)).not.toContain(
        'https://pci.browser-intake-datadoghq.com'
      )
    })
    it('should not return PCI compliance intake endpoint if and site is us1 and track is not logs', () => {
      const config: InitConfiguration & { usePciIntake?: boolean } = {
        clientToken,
        usePciIntake: true,
        site: 'datadoghq.com',
      }
      expect(createEndpointBuilder(config, 'rum').build('fetch', DEFAULT_PAYLOAD)).not.toContain(
        'https://pci.browser-intake-datadoghq.com'
      )
    })
  })

  describe('source configuration', () => {
    it('should use the default source when no configuration is provided', () => {
      const endpoint = createEndpointBuilder(initConfiguration, 'rum').build('fetch', DEFAULT_PAYLOAD)
      expect(endpoint).toContain('ddsource=browser')
    })

    it('should use flutter source when provided', () => {
      const config = { ...initConfiguration, source: 'flutter' as const }
      const endpoint = createEndpointBuilder(config, 'rum').build('fetch', DEFAULT_PAYLOAD)
      expect(endpoint).toContain('ddsource=flutter')
    })

    it('should use unity source when provided', () => {
      const config = { ...initConfiguration, source: 'unity' as const }
      const endpoint = createEndpointBuilder(config, 'rum').build('fetch', DEFAULT_PAYLOAD)
      expect(endpoint).toContain('ddsource=unity')
    })
  })
})
