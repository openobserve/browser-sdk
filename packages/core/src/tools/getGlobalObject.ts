/**
 * inspired by https://mathiasbynens.be/notes/globalthis
 */

export function getGlobalObject<T = typeof globalThis>(): T {
  if (typeof globalThis === 'object') {
    return globalThis as unknown as T
  }
  Object.defineProperty(Object.prototype, '_oo_temp_', {
    get() {
      return this as object
    },
    configurable: true,
  })
  // @ts-ignore _oo_temp is defined using defineProperty
  let globalObject: unknown = _oo_temp_
  // @ts-ignore _oo_temp is defined using defineProperty
  delete Object.prototype._oo_temp_
  if (typeof globalObject !== 'object') {
    // on safari _oo_temp_ is available on window but not globally
    // fallback on other browser globals check
    if (typeof self === 'object') {
      globalObject = self
    } else if (typeof window === 'object') {
      globalObject = window
    } else {
      globalObject = {}
    }
  }
  return globalObject as T
}
