import type { Configuration } from '@openobserve/browser-core'
import { createNewEvent, stubZoneJs } from '../../test'
import { noop } from '../tools/utils/functionUtils'
import { addEventListener, DOM_EVENT } from './addEventListener'

describe('addEventListener', () => {
  let configuration: Configuration

  describe('Zone.js support', () => {
    let zoneJsStub: ReturnType<typeof stubZoneJs>

    beforeEach(() => {
      configuration = { allowUntrustedEvents: false } as Configuration
      zoneJsStub = stubZoneJs()
    })

    afterEach(() => {
      zoneJsStub.restore()
    })

    it('uses the original addEventListener method instead of the method patched by Zone.js', () => {
      const zoneJsPatchedAddEventListener = jasmine.createSpy()
      const eventTarget = document.createElement('div')
      zoneJsStub.replaceProperty(eventTarget, 'addEventListener', zoneJsPatchedAddEventListener)

      addEventListener(configuration, eventTarget, DOM_EVENT.CLICK, noop)
      expect(zoneJsPatchedAddEventListener).not.toHaveBeenCalled()
    })

    it('uses the original removeEventListener method instead of the method patched by Zone.js', () => {
      const zoneJsPatchedRemoveEventListener = jasmine.createSpy()
      const eventTarget = document.createElement('div')
      zoneJsStub.replaceProperty(eventTarget, 'removeEventListener', zoneJsPatchedRemoveEventListener)

      const { stop } = addEventListener(configuration, eventTarget, DOM_EVENT.CLICK, noop)
      stop()
      expect(zoneJsPatchedRemoveEventListener).not.toHaveBeenCalled()
    })
  })

  describe('Untrusted event', () => {
    beforeEach(() => {
      configuration = { allowUntrustedEvents: false } as Configuration
    })

    it('should be ignored if __ddIsTrusted is absent', () => {
      const listener = jasmine.createSpy()
      const eventTarget = document.createElement('div')
      addEventListener(configuration, eventTarget, DOM_EVENT.CLICK, listener)

      const event = createNewEvent(DOM_EVENT.CLICK, { __ddIsTrusted: undefined })
      eventTarget.dispatchEvent(event)
      expect(listener).not.toHaveBeenCalled()
    })

    it('should be ignored if __ddIsTrusted is false', () => {
      const listener = jasmine.createSpy()
      const eventTarget = document.createElement('div')
      addEventListener(configuration, eventTarget, DOM_EVENT.CLICK, listener)

      const event = createNewEvent(DOM_EVENT.CLICK, { __ddIsTrusted: false })
      eventTarget.dispatchEvent(event)
      expect(listener).not.toHaveBeenCalled()
    })

    it('should not be ignored if __ddIsTrusted is true', () => {
      const listener = jasmine.createSpy()
      const eventTarget = document.createElement('div')
      addEventListener(configuration, eventTarget, DOM_EVENT.CLICK, listener)

      const event = createNewEvent(DOM_EVENT.CLICK, { __ddIsTrusted: true })
      eventTarget.dispatchEvent(event)

      expect(listener).toHaveBeenCalled()
    })

    it('should not be ignored if allowUntrustedEvents is true', () => {
      const listener = jasmine.createSpy()
      const eventTarget = document.createElement('div')
      configuration = { allowUntrustedEvents: true } as Configuration

      addEventListener(configuration, eventTarget, DOM_EVENT.CLICK, listener)

      const event = createNewEvent(DOM_EVENT.CLICK, { __ddIsTrusted: undefined })
      eventTarget.dispatchEvent(event)

      expect(listener).toHaveBeenCalled()
    })
  })
})
