import { isIE } from '@openobserve/browser-core'
import { stubZoneJs } from '@openobserve/browser-core/test'
import { createDOMMutationObservable, getMutationObserverConstructor } from './domMutationObservable'

// The MutationObserver invokes its callback in an event loop microtask, making this asynchronous.
// We want to wait for a few event loop executions to potentially collect multiple mutation events.
const DOM_MUTATION_OBSERVABLE_DURATION = 16

describe('domMutationObservable', () => {
  beforeEach(() => {
    if (isIE()) {
      pending('dom mutation not available')
    }
  })

  function domMutationSpec(mutate: (root: HTMLElement) => void, { expectedMutations }: { expectedMutations: number }) {
    return (done: DoneFn) => {
      const root = document.createElement('div')
      root.setAttribute('data-test', 'foo')
      root.appendChild(document.createElement('span'))
      root.appendChild(document.createTextNode('foo'))
      document.body.appendChild(root)

      const domMutationObservable = createDOMMutationObservable()

      let counter = 0
      const domMutationSubscription = domMutationObservable.subscribe(() => (counter += 1))

      mutate(root)

      setTimeout(() => {
        expect(counter).toBe(expectedMutations)
        root.parentNode!.removeChild(root)
        domMutationSubscription.unsubscribe()
        done()
      }, DOM_MUTATION_OBSERVABLE_DURATION)
    }
  }

  it(
    'collects DOM mutation when an element is added',
    domMutationSpec(
      (root) => {
        root.appendChild(document.createElement('button'))
      },
      { expectedMutations: 1 }
    )
  )

  it(
    'collects DOM mutation when a text node is added',
    domMutationSpec(
      (root) => {
        root.appendChild(document.createTextNode('foo'))
      },
      { expectedMutations: 1 }
    )
  )

  it(
    'collects DOM mutation on attribute creation',
    domMutationSpec(
      (root) => {
        root.setAttribute('data-test2', 'bar')
      },
      { expectedMutations: 1 }
    )
  )

  it(
    'collects DOM mutation on attribute change',
    domMutationSpec(
      (root) => {
        root.setAttribute('data-test', 'bar')
      },
      { expectedMutations: 1 }
    )
  )

  it(
    'collects DOM mutation when an element is removed',
    domMutationSpec(
      (root) => {
        root.removeChild(root.childNodes[0])
      },
      { expectedMutations: 1 }
    )
  )

  it(
    'collects DOM mutation when an element is moved',
    domMutationSpec(
      (root) => {
        root.insertBefore(root.childNodes[0], null)
      },
      { expectedMutations: 1 }
    )
  )

  it(
    'collects DOM mutation when text node content changes',
    domMutationSpec(
      (root) => {
        ; (root.childNodes[1] as Text).data = 'bar'
      },
      { expectedMutations: 1 }
    )
  )

  describe('Zone.js support', () => {
    let zoneJsStub: ReturnType<typeof stubZoneJs>
    const OriginalMutationObserverConstructor = window.MutationObserver

    beforeEach(() => {
      zoneJsStub = stubZoneJs()
    })

    afterEach(() => {
      zoneJsStub.restore()
      window.MutationObserver = OriginalMutationObserverConstructor
    })

    it('gets the original MutationObserver constructor from the "window" object (Zone.js >= 0.8.6)', () => {
      zoneJsStub.replaceProperty(window, 'MutationObserver', function () {
        // This won't be instantiated.
      } as any)
      expect(getMutationObserverConstructor()).toBe(OriginalMutationObserverConstructor)
    })

    it('gets the original MutationObserver constructor from a patched instance (Zone.js < 0.8.6)', () => {
      window.MutationObserver = function (this: any, callback: () => void) {
        this[zoneJsStub.getSymbol('originalInstance')] = new OriginalMutationObserverConstructor(callback)
      } as any

      expect(getMutationObserverConstructor()).toBe(OriginalMutationObserverConstructor)
    })
  })
})
