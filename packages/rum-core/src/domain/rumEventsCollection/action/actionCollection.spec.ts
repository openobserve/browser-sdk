import type { Duration, RelativeTime, ServerDuration, TimeStamp } from '@openobserve/browser-core'
import { createNewEvent } from '@openobserve/browser-core/test'
import type { TestSetupBuilder } from '../../../../test'
import { setup } from '../../../../test'
import { RumEventType, ActionType } from '../../../rawRumEvent.types'
import { LifeCycleEventType } from '../../lifeCycle'
import { startActionCollection } from './actionCollection'

describe('actionCollection', () => {
  let setupBuilder: TestSetupBuilder
  let addAction: ReturnType<typeof startActionCollection>['addAction']

  beforeEach(() => {
    setupBuilder = setup()
      .withPageStateHistory({
        isInActivePageStateAt: () => true,
      })
      .beforeBuild(({ lifeCycle, configuration, domMutationObservable, pageStateHistory }) => {
        ; ({ addAction } = startActionCollection(lifeCycle, domMutationObservable, configuration, pageStateHistory))
      })
  })

  afterEach(() => {
    setupBuilder.cleanup()
  })
  it('should create action from auto action', () => {
    const { lifeCycle, rawRumEvents } = setupBuilder.build()

    const event = createNewEvent('pointerup', { target: document.createElement('button') })
    lifeCycle.notify(LifeCycleEventType.AUTO_ACTION_COMPLETED, {
      counts: {
        errorCount: 10,
        longTaskCount: 10,
        resourceCount: 10,
      },
      frustrationTypes: [],
      duration: 100 as Duration,
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      name: 'foo',
      startClocks: { relative: 1234 as RelativeTime, timeStamp: 123456789 as TimeStamp },
      type: ActionType.CLICK,
      event,
      target: {
        selector: '#foo',
        width: 1,
        height: 2,
      },
      position: { x: 1, y: 2 },
      events: [event],
    })

    expect(rawRumEvents[0].startTime).toBe(1234 as RelativeTime)
    expect(rawRumEvents[0].rawRumEvent).toEqual({
      action: {
        error: {
          count: 10,
        },
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        loading_time: (100 * 1e6) as ServerDuration,
        frustration: {
          type: [],
        },
        long_task: {
          count: 10,
        },
        resource: {
          count: 10,
        },
        target: {
          name: 'foo',
        },
        type: ActionType.CLICK,
      },
      date: jasmine.any(Number),
      type: RumEventType.ACTION,
      view: {
        in_foreground: true,
      },
      _oo: {
        action: {
          target: {
            selector: '#foo',
            width: 1,
            height: 2,
          },
          position: {
            x: 1,
            y: 2,
          },
        },
      },
    })
    expect(rawRumEvents[0].domainContext).toEqual({
      event,
      events: [event],
    })
  })

  it('should create action from custom action', () => {
    const { rawRumEvents } = setupBuilder.build()
    addAction({
      name: 'foo',
      startClocks: { relative: 1234 as RelativeTime, timeStamp: 123456789 as TimeStamp },
      type: ActionType.CUSTOM,
    })

    expect(rawRumEvents[0].startTime).toBe(1234 as RelativeTime)
    expect(rawRumEvents[0].rawRumEvent).toEqual({
      action: {
        id: jasmine.any(String),
        target: {
          name: 'foo',
        },
        type: ActionType.CUSTOM,
      },
      date: jasmine.any(Number),
      type: RumEventType.ACTION,
      view: {
        in_foreground: true,
      },
    })
    expect(rawRumEvents[0].domainContext).toEqual({})
  })
})
