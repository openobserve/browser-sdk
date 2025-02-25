import type { RumInitConfiguration } from '@openobserve/browser-rum-core'
import { IncrementalSource, NodeType } from '@openobserve/browser-rum/src/types'
import type { DocumentFragmentNode, MouseInteractionData, SerializedNodeWithId } from '@openobserve/browser-rum/src/types'

import {
  createMutationPayloadValidatorFromSegment,
  findElementWithIdAttribute,
  findElementWithTagName,
  findFullSnapshot,
  findIncrementalSnapshot,
  findNode,
  findTextContent,
  findTextNode,
} from '@openobserve/browser-rum/test'

import type { EventRegistry } from '../../lib/framework'
import { flushEvents, createTest, bundleSetup, html } from '../../lib/framework'
import { browserExecute } from '../../lib/helpers/browser'

/** Will generate the following HTML
 * ```html
 * <my-input-field id="titi">
 *  #shadow-root
 *    <div>
 *      <label  id="label-titi">field titi: </label>
 *      <input id="input-titi" value="toto">
 *    </div>
 *</my-input-field>
 *```
 when called like `<my-input-field id="titi" />`
 */
const inputShadowDom = `<script>
 class MyInputField extends HTMLElement {
   constructor() {
     super();
     this.attachShadow({ mode: "open" });
   }
   connectedCallback() {
     const componentId = this.getAttribute('id') ?? '';
     const privacyOverride = this.getAttribute("privacy");
     const parent = document.createElement("div");
     if (privacyOverride) {
       parent.setAttribute("data-oo-privacy", privacyOverride);
     }
     const label = document.createElement("label");
     label.setAttribute("id", "label-" + componentId);
     label.innerText = "field " + componentId + ": ";
     const input = document.createElement("input");
     input.setAttribute("id", "input-" + componentId);
     input.value = "toto"
     parent.appendChild(label)
     parent.appendChild(input)
     this.shadowRoot.appendChild(parent);
   }
 }
       window.customElements.define("my-input-field", MyInputField);
 </script>
 `

/** Will generate the following HTML
 * ```html
 * <my-div id="titi">
 *  #shadow-root
 *    <div>toto</div>
 *</my-div>
 *```
 when called like `<my-div />`
 */
const divShadowDom = `<script>
 class CustomDiv extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }
  connectedCallback() {
    const div = document.createElement("div");
    div.textContent = 'toto'
    this.shadowRoot.appendChild(div);
  }
}
      window.customElements.define("my-div", CustomDiv);
 </script>
 `

/** Will generate the following HTML
 * ```html
 * <div-with-style>
 *  #shadow-root
 *    <div>toto</div>
 *</div-with-style>
 *```
 when called like `<div-with-style />`
 */
const divWithStyleShadowDom = `<script>
class DivWithStyle extends HTMLElement {
 constructor() {
   super();
   this.attachShadow({ mode: "open" });
 }
 connectedCallback() {
   const div = document.createElement("div");
   div.textContent = 'toto'
   this.shadowRoot.appendChild(div);
   const styleSheet = new CSSStyleSheet();
   styleSheet.insertRule('div { width: 100%; }')
   this.shadowRoot.adoptedStyleSheets = [styleSheet]
 }
}
     window.customElements.define("div-with-style", DivWithStyle);
</script>
`

describe('recorder with shadow DOM', () => {
  createTest('can record fullsnapshot with the detail inside the shadow root')
    .withRum({ defaultPrivacyLevel: 'allow' })
    .withRumInit(initRumAndStartRecording)
    .withSetup(bundleSetup)
    .withBody(html`
      ${divShadowDom}
      <my-div />
    `)
    .run(async ({ serverEvents }) => {
      await flushEvents()

      expect(serverEvents.sessionReplay.length).toBe(1)

      const fullSnapshot = findFullSnapshot(getFirstSegment(serverEvents))!
      expect(fullSnapshot).toBeTruthy()

      const textNode = findTextNode(fullSnapshot.data.node, 'toto')
      expect(textNode).toBeTruthy()
      expect(textNode?.textContent).toBe('toto')
    })

  createTest('can record fullsnapshot with adoptedStylesheet')
    .withRum()
    .withRumInit(initRumAndStartRecording)
    .withSetup(bundleSetup)
    .withBody(html`
      ${divWithStyleShadowDom}
      <div-with-style />
    `)
    .run(async ({ serverEvents }) => {
      if (!(await isAdoptedStyleSheetsSupported())) {
        return pending('adoptedStyleSheets is not supported in this browser')
      }
      await flushEvents()

      expect(serverEvents.sessionReplay.length).toBe(1)

      const fullSnapshot = findFullSnapshot(getFirstSegment(serverEvents))!
      expect(fullSnapshot).toBeTruthy()
      const shadowRoot = findNode(
        fullSnapshot.data.node,
        (node) => node.type === NodeType.DocumentFragment
      ) as DocumentFragmentNode
      expect(shadowRoot.isShadowRoot).toBe(true)
      expect(shadowRoot.adoptedStyleSheets).toEqual([{ cssRules: ['div { width: 100%; }'] }])
    })

  createTest('can apply privacy level set from outside or inside the shadow DOM')
    .withRum({ defaultPrivacyLevel: 'allow' })
    .withRumInit(initRumAndStartRecording)
    .withSetup(bundleSetup)
    .withBody(html`
      ${inputShadowDom}
      <div data-oo-privacy="mask-user-input"><my-input-field id="privacy-set-outside" /></div>
      <my-input-field privacy="mask-user-input" id="privacy-set-inside" />
    `)
    .run(async ({ serverEvents }) => {
      await flushEvents()

      expect(serverEvents.sessionReplay.length).toBe(1)

      const fullSnapshot = findFullSnapshot(getFirstSegment(serverEvents))!
      expect(fullSnapshot).toBeTruthy()

      const {
        input: outsideInput,
        shadowRoot: outsideShadowRoot,
        textContent: outsideTextContent,
      } = findElementsInShadowDom(fullSnapshot.data.node, 'privacy-set-outside')
      expect(outsideShadowRoot?.isShadowRoot).toBeTrue()
      expect(outsideInput?.attributes.value).toBe('***')
      expect(outsideTextContent).toBe('field privacy-set-outside: ')

      const {
        input: insideInput,
        shadowRoot: insideShadowRoot,
        textContent: insideTextContent,
      } = findElementsInShadowDom(fullSnapshot.data.node, 'privacy-set-inside')
      expect(insideShadowRoot?.isShadowRoot).toBeTrue()
      expect(insideInput?.attributes.value).toBe('***')
      expect(insideTextContent).toBe('field privacy-set-inside: ')
    })

  createTest('can record click with target from inside the shadow root')
    .withRum()
    .withRumInit(initRumAndStartRecording)
    .withSetup(bundleSetup)
    .withBody(html`
      ${divShadowDom}
      <my-div />
    `)
    .run(async ({ serverEvents }) => {
      const div = await getNodeInsideShadowDom('my-div', 'div')
      await div.click()
      await flushEvents()
      expect(serverEvents.sessionReplay.length).toBe(1)
      const fullSnapshot = findFullSnapshot(getFirstSegment(serverEvents))!
      const divNode = findElementWithTagName(fullSnapshot.data.node, 'div')!
      const mouseInteraction = findIncrementalSnapshot(
        getFirstSegment(serverEvents),
        IncrementalSource.MouseInteraction
      )!
      expect(mouseInteraction).toBeTruthy()
      expect(mouseInteraction.data.source).toBe(IncrementalSource.MouseInteraction)
      expect((mouseInteraction.data as MouseInteractionData).id).toBe(divNode.id)
    })

  createTest('can record mutation from inside the shadow root')
    .withRum({ defaultPrivacyLevel: 'allow' })
    .withRumInit(initRumAndStartRecording)
    .withSetup(bundleSetup)
    .withBody(html`
      ${divShadowDom}
      <my-div id="host" />
    `)
    .run(async ({ serverEvents }) => {
      await browserExecute(() => {
        const host = document.body.querySelector('#host') as HTMLElement
        const div = host.shadowRoot!.querySelector('div') as HTMLElement
        div.innerText = 'titi'
      })
      await flushEvents()
      expect(serverEvents.sessionReplay.length).toBe(1)
      const { validate, expectInitialNode, expectNewNode } = createMutationPayloadValidatorFromSegment(
        getFirstSegment(serverEvents)
      )
      validate({
        adds: [
          {
            parent: expectInitialNode({ tag: 'div' }),
            node: expectNewNode({ type: NodeType.Text, textContent: 'titi' }),
          },
        ],
        removes: [
          {
            parent: expectInitialNode({ tag: 'div' }),
            node: expectInitialNode({ text: 'toto' }),
          },
        ],
      })
    })
})

function findElementsInShadowDom(node: SerializedNodeWithId, id: string) {
  const shadowHost = findElementWithIdAttribute(node, id)
  expect(shadowHost).toBeTruthy()

  const shadowRoot = shadowHost!.childNodes.find(
    (node) => node.type === NodeType.DocumentFragment && node.isShadowRoot
  ) as DocumentFragmentNode
  expect(shadowRoot).toBeTruthy()

  const input = findElementWithIdAttribute(node, `input-${id}`)
  expect(input).toBeTruthy()

  const text = findElementWithIdAttribute(node, `label-${id}`)
  expect(text).toBeTruthy()
  const textContent = findTextContent(text!)
  expect(textContent).toBeTruthy()
  return { shadowHost, shadowRoot, input, text, textContent }
}

function getFirstSegment(events: EventRegistry) {
  return events.sessionReplay[0].segment.data
}

function initRumAndStartRecording(initConfiguration: RumInitConfiguration) {
  window.OO_RUM!.init(initConfiguration)
  window.OO_RUM!.startSessionReplayRecording()
}

async function getNodeInsideShadowDom(hostTag: string, selector: string) {
  const host = await $(hostTag)
  return host.shadow$(selector)
}

function isAdoptedStyleSheetsSupported(): Promise<boolean> {
  return browserExecute(() => document.adoptedStyleSheets !== undefined) as Promise<boolean>
}
