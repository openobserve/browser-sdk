import type { BuildEnvWindow } from '../../../test'
import {
  ExperimentalFeature,
  resetExperimentalFeatures,
  addExperimentalFeatures,
} from '../../tools/experimentalFeatures'
import { startsWith } from '../../tools/utils/polyfills'
import type { InitConfiguration } from './configuration'
import { createEndpointBuilder } from './endpointBuilder'

describe('endpointBuilder', () => {
  const clientToken = 'some_client_token'
  let initConfiguration: InitConfiguration

  beforeEach(() => {
    initConfiguration = { clientToken }
    ;(window as unknown as BuildEnvWindow).__BUILD_ENV__SDK_VERSION__ = 'some_version'
    resetExperimentalFeatures()
  })

  describe('query parameters', () => {
    it('should add intake query parameters', () => {
      expect(createEndpointBuilder(initConfiguration, 'rum', []).build('xhr')).toMatch(
        `&o2-api-key=${clientToken}&o2-evp-origin-version=(.*)&o2-evp-origin=browser&o2-request-id=(.*)`
      )
    })

    it('should add batch_time for rum endpoint', () => {
      expect(createEndpointBuilder(initConfiguration, 'rum', []).build('xhr')).toContain('&batch_time=')
    })

    it('should not add batch_time for logs and replay endpoints', () => {
      expect(createEndpointBuilder(initConfiguration, 'logs', []).build('xhr')).not.toContain('&batch_time=')
      expect(createEndpointBuilder(initConfiguration, 'sessionReplay', []).build('xhr')).not.toContain('&batch_time=')
    })

    it('should not start with o2source for internal analytics mode', () => {
      const url = createEndpointBuilder({ ...initConfiguration, internalAnalyticsSubdomain: 'foo' }, 'rum', []).build(
        'xhr'
      )
      expect(url).not.toContain('/rum?o2source')
      expect(url).toContain('o2source=browser')
    })
  })

  describe('proxy configuration', () => {
    it('should replace the intake endpoint by the proxy and set the intake path and parameters in the attribute ooforward', () => {
      expect(
        createEndpointBuilder({ ...initConfiguration, proxy: 'https://proxy.io/path' }, 'rum', []).build('xhr')
      ).toMatch(
        `https://proxy.io/path\\?ooforward=${encodeURIComponent(
          `/rum/v2/xyz/rum?o2source=(.*)&o2tags=(.*)&o2-api-key=${clientToken}` +
            '&o2-evp-origin-version=(.*)&o2-evp-origin=browser&o2-request-id=(.*)&batch_time=(.*)'
        )}`
      )
    })

    it('normalizes the proxy url', () => {
      expect(
        startsWith(
          createEndpointBuilder({ ...initConfiguration, proxy: '/path' }, 'rum', []).build('xhr'),
          `${location.origin}/path?ooforward`
        )
      ).toBeTrue()
    })

    it('uses `proxy` over `proxyUrl`', () => {
      expect(
        createEndpointBuilder(
          { ...initConfiguration, proxy: 'https://proxy.io/path', proxyUrl: 'https://legacy-proxy.io/path' },
          'rum',
          []
        ).build('xhr')
      ).toMatch(/^https:\/\/proxy.io\/path\?/)

      expect(
        createEndpointBuilder(
          { ...initConfiguration, proxy: false as any, proxyUrl: 'https://legacy-proxy.io/path' },
          'rum',
          []
        ).build('xhr')
      ).toMatch(/^https:\/\/api.openobserve.ai\//)
    })
  })

  describe('deprecated proxyUrl configuration', () => {
    it('should replace the full intake endpoint by the proxyUrl and set it in the attribute ooforward', () => {
      expect(
        createEndpointBuilder({ ...initConfiguration, proxyUrl: 'https://proxy.io/path' }, 'rum', []).build('xhr')
      ).toMatch(
        `https://proxy.io/path\\?ooforward=${encodeURIComponent(
          `https://api.openobserve.ai/rum/v2/xyz/rum?o2source=(.*)&o2tags=(.*)&o2-api-key=${clientToken}` +
            '&o2-evp-origin-version=(.*)&o2-evp-origin=browser&o2-request-id=(.*)&batch_time=(.*)'
        )}`
      )
    })

    it('normalizes the proxy url', () => {
      expect(
        startsWith(
          createEndpointBuilder({ ...initConfiguration, proxyUrl: '/path' }, 'rum', []).build('xhr'),
          `${location.origin}/path?ooforward`
        )
      ).toBeTrue()
    })
  })

  describe('tags', () => {
    it('should contain sdk version', () => {
      expect(createEndpointBuilder(initConfiguration, 'rum', []).build('xhr')).toContain('sdk_version%3Asome_version')
    })

    it('should contain api', () => {
      expect(createEndpointBuilder(initConfiguration, 'rum', []).build('xhr')).toContain('api%3Axhr')
    })

    it('should be encoded', () => {
      expect(
        createEndpointBuilder(initConfiguration, 'rum', ['service:bar:foo', 'datacenter:us1.prod.dog']).build('xhr')
      ).toContain('service%3Abar%3Afoo%2Cdatacenter%3Aus1.prod.dog')
    })

    it('should contain retry infos', () => {
      expect(
        createEndpointBuilder(initConfiguration, 'rum', []).build('xhr', 'bytes_limit', {
          count: 5,
          lastFailureStatus: 408,
        })
      ).toContain('retry_count%3A5%2Cretry_after%3A408')
    })

    it('should contain flush reason when ff collect_flush_reason is enabled', () => {
      addExperimentalFeatures([ExperimentalFeature.COLLECT_FLUSH_REASON])
      expect(createEndpointBuilder(initConfiguration, 'rum', []).build('xhr', 'bytes_limit')).toContain(
        'flush_reason%3Abytes_limit'
      )
    })

    it('should not contain flush reason when ff collect_flush_reason is disnabled', () => {
      expect(createEndpointBuilder(initConfiguration, 'rum', []).build('xhr', 'bytes_limit')).not.toContain(
        'flush_reason'
      )
    })
  })
})
