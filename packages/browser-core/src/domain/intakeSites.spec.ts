import { isIntakeUrl, MAX_PROXIED_INTAKE_URLS, registerProxiedIntakeUrl } from './intakeSites'

describe('intakeSites', () => {
  const clientToken = 'some_client_token'
  const intakeParameters = 'o2source=browser&o2-api-key=xxxx&o2-request-id=1234567890'

  describe('isIntakeUrl', () => {
    const v1IntakePath = `/v1/input/${clientToken}`
    ;[
      { site: 'datadoghq.eu', intakeDomain: 'browser-intake-datadoghq.eu' },
      { site: 'datadoghq.com', intakeDomain: 'browser-intake-datadoghq.com' },
      { site: 'us3.datadoghq.com', intakeDomain: 'browser-intake-us3-datadoghq.com' },
      { site: 'us5.datadoghq.com', intakeDomain: 'browser-intake-us5-datadoghq.com' },
      { site: 'ap1.datadoghq.com', intakeDomain: 'browser-intake-ap1-datadoghq.com' },
      { site: 'ddog-gov.com', intakeDomain: 'browser-intake-ddog-gov.com' },
      { site: 'datad0g.com', intakeDomain: 'browser-intake-datad0g.com' },
    ].forEach(({ site, intakeDomain }) => {
      it(`should detect intake request to ${intakeDomain} for site ${site}`, () => {
        expect(isIntakeUrl(`https://${intakeDomain}/api/v2/rum?${intakeParameters}`)).toBe(true)
        expect(isIntakeUrl(`https://${intakeDomain}/api/v2/logs?${intakeParameters}`)).toBe(true)
        expect(isIntakeUrl(`https://${intakeDomain}/api/v2/replay?${intakeParameters}`)).toBe(true)
      })

      it(`should detect older versions of the ${site} site for intake domain ${intakeDomain}`, () => {
        // v4 intake endpoints
        expect(isIntakeUrl(`https://rum.${intakeDomain}/api/v2/rum?${intakeParameters}`)).toBe(true)
        expect(isIntakeUrl(`https://logs.${intakeDomain}/api/v2/logs?${intakeParameters}`)).toBe(true)
        expect(isIntakeUrl(`https://replay.${intakeDomain}/api/v2/replay?${intakeParameters}`)).toBe(true)

        // pre-v4 intake endpoints
        expect(isIntakeUrl(`https://rum.${intakeDomain}${v1IntakePath}?${intakeParameters}`)).toBe(true)
        expect(isIntakeUrl(`https://logs.${intakeDomain}${v1IntakePath}?${intakeParameters}`)).toBe(true)
        expect(isIntakeUrl(`https://rum-http-intake.logs.${site}${v1IntakePath}?${intakeParameters}`)).toBe(true)
        expect(isIntakeUrl(`https://browser-http-intake.logs.${site}${v1IntakePath}?${intakeParameters}`)).toBe(true)
      })
    })

    it('should not detect non intake request', () => {
      expect(isIntakeUrl('https://www.foo.com')).toBe(false)
    })

    describe('proxy configuration', () => {
      it('should detect proxy intake request', () => {
        expect(
          isIntakeUrl(`https://www.proxy.com/?o2forward=${encodeURIComponent(`/api/v2/rum?${intakeParameters}`)}`)
        ).toBe(true)
        expect(
          isIntakeUrl(
            `https://www.proxy.com/custom/path?o2forward=${encodeURIComponent(`/api/v2/rum?${intakeParameters}`)}`
          )
        ).toBe(true)
      })

      it('should not detect request done on the same host as the proxy', () => {
        expect(isIntakeUrl('https://www.proxy.com/foo')).toBe(false)
      })
    })

    describe('registered proxy function URLs', () => {
      it('should detect a registered URL whatever its query string', () => {
        registerProxiedIntakeUrl('https://www.proxy.com/intake/1?token=xxxx')

        expect(isIntakeUrl('https://www.proxy.com/intake/1')).toBe(true)
        expect(isIntakeUrl('https://www.proxy.com/intake/1?token=yyyy&other=1')).toBe(true)
        expect(isIntakeUrl('https://www.proxy.com/intake/1#fragment')).toBe(true)
      })

      it('should detect a registered relative URL once resolved by the browser', () => {
        registerProxiedIntakeUrl('/intake/2?token=xxxx')

        expect(isIntakeUrl(`${location.origin}/intake/2?token=xxxx`)).toBe(true)
      })

      it('should not detect other paths, hosts or paths that only share a prefix', () => {
        registerProxiedIntakeUrl('https://www.proxy.com/intake/1?token=xxxx')

        expect(isIntakeUrl('https://www.proxy.com/intake/10')).toBe(false)
        expect(isIntakeUrl('https://www.proxy.com/intake')).toBe(false)
        expect(isIntakeUrl('https://www.proxy.com/intake/1/more')).toBe(false)
        expect(isIntakeUrl('https://other.proxy.com/intake/1')).toBe(false)
        expect(isIntakeUrl('https://www.proxy.com/foo?url=https://www.proxy.com/intake/1')).toBe(false)
      })

      it('should ignore invalid URLs', () => {
        expect(() => registerProxiedIntakeUrl('http://')).not.toThrow()
        expect(() => registerProxiedIntakeUrl(undefined as unknown as string)).not.toThrow()
      })

      it('should not register more than the maximum number of URLs', () => {
        for (let i = 0; i < MAX_PROXIED_INTAKE_URLS; i += 1) {
          registerProxiedIntakeUrl(`https://www.proxy.com/intake/${i}`)
        }
        registerProxiedIntakeUrl('https://www.proxy.com/intake/over-the-limit')

        expect(isIntakeUrl('https://www.proxy.com/intake/0')).toBe(true)
        expect(isIntakeUrl('https://www.proxy.com/intake/over-the-limit')).toBe(false)
      })
    })
    ;[
      { site: 'datadoghq.eu' },
      { site: 'us3.datadoghq.com' },
      { site: 'us5.datadoghq.com' },
      { site: 'ap1.datadoghq.com' },
    ].forEach(({ site }) => {
      it(`should detect replica intake request for site ${site}`, () => {
        expect(isIntakeUrl(`https://browser-intake-datadoghq.com/api/v2/rum?${intakeParameters}`)).toBe(true)
        expect(isIntakeUrl(`https://browser-intake-datadoghq.com/api/v2/logs?${intakeParameters}`)).toBe(true)
        expect(isIntakeUrl(`https://browser-intake-datadoghq.com/api/v2/replay?${intakeParameters}`)).toBe(true)
      })
    })
  })
})
