import { openobserveRum } from '@openobserve/browser-rum'
import { openobserveLogs } from '@openobserve/browser-logs'
import packageJson from '../../package.json'
import { DEFAULT_PANEL_TAB } from '../common/constants'

export function initMonitoring() {
  openobserveRum.init({
    applicationId: '235202fa-3da1-4aeb-abc4-d01b10ca1539',
    clientToken: 'pub74fd472504982beb427b647893758040',
    site: 'api.openobserve.ai',
    service: 'browser-sdk-developer-extension',
    env: 'prod',
    version: packageJson.version,
    allowFallbackToLocalStorage: true,
    sessionSampleRate: 100,
    sessionReplaySampleRate: 100,
    telemetrySampleRate: 100,
    trackUserInteractions: true,
    trackViewsManually: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask',
  })
  openobserveRum.startSessionReplayRecording()
  openobserveRum.startView(DEFAULT_PANEL_TAB)

  openobserveLogs.init({
    clientToken: 'pub74fd472504982beb427b647893758040',
    site: 'api.openobserve.ai',
    service: 'browser-sdk-developer-extension',
    env: 'prod',
    version: packageJson.version,
    allowFallbackToLocalStorage: true,
    forwardErrorsToLogs: true,
    forwardConsoleLogs: 'all',
    forwardReports: 'all',
    sessionSampleRate: 100,
    telemetrySampleRate: 100,
  })
}
