import type { Duration, ServerDuration, Observable } from '@openobserve/browser-core'
import {
  isExperimentalFeatureEnabled,
  ExperimentalFeature,
  isEmptyObject,
  mapValues,
  toServerDuration,
  isNumber,
} from '@openobserve/browser-core'
import type { RecorderApi } from '../../../boot/rumPublicApi'
import type { RawRumViewEvent } from '../../../rawRumEvent.types'
import { RumEventType } from '../../../rawRumEvent.types'
import type { LifeCycle, RawRumEventCollectedData } from '../../lifeCycle'
import { LifeCycleEventType } from '../../lifeCycle'
import { mapToForegroundPeriods } from '../../contexts/foregroundContexts'
import type { LocationChange } from '../../../browser/locationChangeObservable'
import type { RumConfiguration } from '../../configuration'
import type { FeatureFlagContexts } from '../../contexts/featureFlagContext'
import type { PageStateHistory } from '../../contexts/pageStateHistory'
import type { ViewEvent, ViewOptions } from './trackViews'
import { trackViews } from './trackViews'
import type { WebVitalTelemetryDebug } from './startWebVitalTelemetryDebug'

export function startViewCollection(
  lifeCycle: LifeCycle,
  configuration: RumConfiguration,
  location: Location,
  domMutationObservable: Observable<void>,
  locationChangeObservable: Observable<LocationChange>,
  featureFlagContexts: FeatureFlagContexts,
  pageStateHistory: PageStateHistory,
  recorderApi: RecorderApi,
  webVitalTelemetryDebug: WebVitalTelemetryDebug,
  initialViewOptions?: ViewOptions
) {
  lifeCycle.subscribe(LifeCycleEventType.VIEW_UPDATED, (view) =>
    lifeCycle.notify(
      LifeCycleEventType.RAW_RUM_EVENT_COLLECTED,
      processViewUpdate(view, configuration, featureFlagContexts, recorderApi, pageStateHistory)
    )
  )
  const trackViewResult = trackViews(
    location,
    lifeCycle,
    domMutationObservable,
    configuration,
    locationChangeObservable,
    !configuration.trackViewsManually,
    webVitalTelemetryDebug,
    initialViewOptions
  )

  return trackViewResult
}

function processViewUpdate(
  view: ViewEvent,
  configuration: RumConfiguration,
  featureFlagContexts: FeatureFlagContexts,
  recorderApi: RecorderApi,
  pageStateHistory: PageStateHistory
): RawRumEventCollectedData<RawRumViewEvent> {
  const replayStats = recorderApi.getReplayStats(view.id)
  const featureFlagContext = featureFlagContexts.findFeatureFlagEvaluations(view.startClocks.relative)
  const pageStatesEnabled = isExperimentalFeatureEnabled(ExperimentalFeature.PAGE_STATES)
  const pageStates = pageStateHistory.findAll(view.startClocks.relative, view.duration)
  const viewEvent: RawRumViewEvent = {
    _oo: {
      document_version: view.documentVersion,
      replay_stats: replayStats,
      page_states: pageStatesEnabled ? pageStates : undefined,
    },
    date: view.startClocks.timeStamp,
    type: RumEventType.VIEW,
    view: {
      action: {
        count: view.eventCounts.actionCount,
      },
      frustration: {
        count: view.eventCounts.frustrationCount,
      },
      cumulative_layout_shift: view.commonViewMetrics.cumulativeLayoutShift,
      first_byte: toServerDuration(view.initialViewMetrics.firstByte),
      dom_complete: toServerDuration(view.initialViewMetrics.domComplete),
      dom_content_loaded: toServerDuration(view.initialViewMetrics.domContentLoaded),
      dom_interactive: toServerDuration(view.initialViewMetrics.domInteractive),
      error: {
        count: view.eventCounts.errorCount,
      },
      first_contentful_paint: toServerDuration(view.initialViewMetrics.firstContentfulPaint),
      first_input_delay: toServerDuration(view.initialViewMetrics.firstInputDelay),
      first_input_time: toServerDuration(view.initialViewMetrics.firstInputTime),
      interaction_to_next_paint: toServerDuration(view.commonViewMetrics.interactionToNextPaint),
      is_active: view.isActive,
      name: view.name,
      largest_contentful_paint: toServerDuration(view.initialViewMetrics.largestContentfulPaint),
      load_event: toServerDuration(view.initialViewMetrics.loadEvent),
      loading_time: discardNegativeDuration(toServerDuration(view.commonViewMetrics.loadingTime)),
      loading_type: view.loadingType,
      long_task: {
        count: view.eventCounts.longTaskCount,
      },
      resource: {
        count: view.eventCounts.resourceCount,
      },
      time_spent: toServerDuration(view.duration),
      in_foreground_periods:
        !pageStatesEnabled && pageStates ? mapToForegroundPeriods(pageStates, view.duration) : undefined, // Todo: Remove in the next major release
    },
    feature_flags: featureFlagContext && !isEmptyObject(featureFlagContext) ? featureFlagContext : undefined,
    display: view.commonViewMetrics.scroll
      ? {
        scroll: {
          max_depth: view.commonViewMetrics.scroll.maxDepth,
          max_depth_scroll_height: view.commonViewMetrics.scroll.maxDepthScrollHeight,
          max_depth_scroll_top: view.commonViewMetrics.scroll.maxDepthScrollTop,
          max_depth_time: toServerDuration(view.commonViewMetrics.scroll.maxDepthTime),
        },
      }
      : undefined,
    session: {
      has_replay: replayStats ? true : undefined,
      is_active: view.sessionIsActive ? undefined : false,
    },
    privacy: {
      replay_level: configuration.defaultPrivacyLevel,
    },
  }
  if (!isEmptyObject(view.customTimings)) {
    viewEvent.view.custom_timings = mapValues(
      view.customTimings,
      toServerDuration as (duration: Duration) => ServerDuration
    )
  }
  return {
    rawRumEvent: viewEvent,
    startTime: view.startClocks.relative,
    domainContext: {
      location: view.location,
    },
  }
}

function discardNegativeDuration(duration: ServerDuration | undefined): ServerDuration | undefined {
  return isNumber(duration) && duration < 0 ? undefined : duration
}
