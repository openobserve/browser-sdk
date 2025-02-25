import { isIE } from '@openobserve/browser-core'
import { getCssRulesString } from './serializeAttributes'

describe('getCssRulesString', () => {
  let styleNode: HTMLStyleElement

  beforeEach(() => {
    if (isIE()) {
      pending('IE not supported')
    }
    styleNode = document.createElement('style')
    document.body.appendChild(styleNode)
  })
  afterEach(() => {
    document.body.removeChild(styleNode)
  })

  it('returns the CSS rules as a string', () => {
    styleNode.sheet!.insertRule('body { color: red; }')

    expect(getCssRulesString(styleNode.sheet)).toBe('body { color: red; }')
  })

  it('inlines imported external stylesheets', () => {
    styleNode.sheet!.insertRule('@import url("toto.css");')

    // Simulates an accessible external stylesheet
    spyOnProperty(styleNode.sheet!.cssRules[0] as CSSImportRule, 'styleSheet').and.returnValue({
      cssRules: [{ cssText: 'p { margin: 0; }' } as CSSRule] as unknown as CSSRuleList,
    } as CSSStyleSheet)

    expect(getCssRulesString(styleNode.sheet)).toBe('p { margin: 0; }')
  })

  it('does not skip the @import rules if the external stylesheet is inaccessible', () => {
    styleNode.sheet!.insertRule('@import url("toto.css");')

    // Simulates an inaccessible external stylesheet
    spyOnProperty(styleNode.sheet!.cssRules[0] as CSSImportRule, 'styleSheet').and.returnValue({
      get cssRules(): CSSRuleList {
        throw new Error('Cannot access rules')
      },
    } as CSSStyleSheet)

    expect(getCssRulesString(styleNode.sheet)).toBe('@import url("toto.css");')
  })
})
