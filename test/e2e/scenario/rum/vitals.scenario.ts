import { test, expect } from '@playwright/test'
import { ExperimentalFeature } from '@openobserve/browser-core'
import { createTest } from '../../lib/framework'

test.describe('vital collection', () => {
  createTest('send custom duration vital')
    .withRum()
    .run(async ({ flushEvents, intakeRegistry, page }) => {
      await page.evaluate(() => {
        const vital = window.OO_RUM!.startDurationVital('foo')
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            window.OO_RUM!.stopDurationVital(vital)
            resolve()
          }, 5)
        })
      })
      await flushEvents()

      expect(intakeRegistry.rumVitalEvents).toHaveLength(1)
      expect(intakeRegistry.rumVitalEvents[0].vital.name).toEqual('foo')
      expect(intakeRegistry.rumVitalEvents[0].vital.duration).toEqual(expect.any(Number))
    })

  createTest('send operation step vital')
    .withRum({
      enableExperimentalFeatures: [ExperimentalFeature.FEATURE_OPERATION_VITAL],
    })
    .run(async ({ flushEvents, intakeRegistry, page }) => {
      await page.evaluate(() => {
        window.OO_RUM!.startFeatureOperation('foo')
      })
      await flushEvents()

      expect(intakeRegistry.rumVitalEvents).toHaveLength(1)
      expect(intakeRegistry.rumVitalEvents[0].vital.name).toEqual('foo')
      expect(intakeRegistry.rumVitalEvents[0].vital.step_type).toEqual('start')
    })
})
