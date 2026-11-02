import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getPackageName } from './computeBundleSize.ts'

describe('getPackageName', () => {
  const cases: Array<[file: string, expected: string]> = [
    ['openobserve-rum.js', 'rum'],
    ['openobserve-logs.js', 'logs'],
    ['openobserve-rum-slim.js', 'rum_slim'],
    ['worker.js', 'worker'],
    ['openobserve-rum-salesforce.js', 'rum_salesforce'],
    ['chunks/profiler-3cbd6ffef10ac40eb2cd-openobserve-rum.js', 'rum_profiler'],
    ['chunks/recorder-531f1c41bdc9a22e4845-openobserve-rum.js', 'rum_recorder'],
    ['chunks/profiler-3cbd6ffef10ac40eb2cd-openobserve-rum-salesforce.js', 'rum_salesforce_profiler'],
    ['chunks/recorder-4ace47c1ea1f698b8e26-openobserve-rum-shopify.js', 'rum_shopify_recorder'],
  ]

  for (const [file, expected] of cases) {
    it(`should return ${expected} for ${file}`, () => {
      assert.equal(getPackageName(file), expected)
    })
  }
})
