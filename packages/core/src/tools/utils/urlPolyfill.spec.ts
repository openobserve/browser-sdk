import { isFirefox } from '../../../test'
import { isIE } from './browserDetection'
import { getHash, getOrigin, getPathName, getSearch, isValidUrl, normalizeUrl, getLocationOrigin } from './urlPolyfill'

describe('normalize url', () => {
  it('should add origin to relative path', () => {
    expect(normalizeUrl('/my/path')).toEqual(`${getLocationOrigin()}/my/path`)
  })

  it('should add protocol to relative url', () => {
    expect(normalizeUrl('//foo.com:9876/my/path')).toEqual('http://foo.com:9876/my/path')
  })

  it('should keep full url unchanged', () => {
    expect(normalizeUrl('https://foo.com/my/path')).toEqual('https://foo.com/my/path')
  })

  it('should keep non http url unchanged', () => {
    expect(normalizeUrl('ftp://foo.com/my/path')).toEqual('ftp://foo.com/my/path')
  })

  it('should keep file url unchanged', () => {
    if (isFirefox()) {
      // On firefox, URL host is empty for file URI: 'https://bugzilla.mozilla.org/show_bug.cgi?id=1578787'
      expect(normalizeUrl('file://foo.com/my/path')).toEqual('file:///my/path')
    } else {
      expect(normalizeUrl('file://foo.com/my/path')).toEqual('file://foo.com/my/path')
    }
  })
})

describe('isValidUrl', () => {
  it('should ensure url is valid', () => {
    expect(isValidUrl('https://cloud.openobserve.ai/')).toBe(true)
    expect(isValidUrl('https://api.openobserve.ai/')).toBe(true)
    expect(isValidUrl('file://cloud.openobserve.ai')).toBe(true)
    expect(isValidUrl('/plop')).toBe(false)
    expect(isValidUrl('')).toBe(false)
  })

  it('should return the same result if the URL has been wrongfully overridden between calls', () => {
    expect(isValidUrl('https://cloud.openobserve.ai/')).toBe(true)
    spyOn(window, 'URL').and.throwError('wrong URL override')
    expect(isValidUrl('https://cloud.openobserve.ai')).toBe(true)
  })
})

describe('getOrigin', () => {
  it('should retrieve url origin', () => {
    expect(getOrigin('http://cloud.openobserve.ai')).toBe('http://cloud.openobserve.ai')
    expect(getOrigin('http://cloud.openobserve.ai/foo/bar?a=b#hello')).toBe('http://cloud.openobserve.ai')
    expect(getOrigin('http://localhost:8080')).toBe('http://localhost:8080')
  })

  it('should retrieve file url origin', () => {
    if (isIE()) {
      // On IE, our origin fallback strategy contains the host
      expect(getOrigin('file://foo.com/my/path')).toEqual('file://foo.com')
    } else {
      expect(getOrigin('file://foo.com/my/path')).toEqual('file://')
    }
  })
})

describe('getPathName', () => {
  it('should retrieve url path name', () => {
    expect(getPathName('http://cloud.openobserve.ai')).toBe('/')
    expect(getPathName('http://cloud.openobserve.ai/foo/bar?a=b#hello')).toBe('/foo/bar')
  })
})

describe('getSearch', () => {
  it('should retrieve url search', () => {
    expect(getSearch('http://cloud.openobserve.ai')).toBe('')
    expect(getSearch('http://cloud.openobserve.ai/foo/bar?a=b#hello')).toBe('?a=b')
  })
})

describe('getHash', () => {
  it('should retrieve url hash', () => {
    expect(getHash('http://cloud.openobserve.ai')).toBe('')
    expect(getHash('http://cloud.openobserve.ai/foo/bar?a=b#hello')).toBe('#hello')
  })
})
