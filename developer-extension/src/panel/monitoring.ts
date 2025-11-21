import { openobserveRum } from '@openobserve/browser-rum'
import { openobserveLogs } from '@openobserve/browser-logs'
import packageJson from '../../package.json'
import { DEFAULT_PANEL_TAB } from '../common/panelTabConstants'

export function initMonitoring() {
  openobserveRum.init({
    applicationId: '235202fa-3da1-4aeb-abc4-d01b10ca1539',
    clientToken: 'pub74fd472504982beb427b647893758040',
    site: 'api.openobserve.ai',
    service: 'browser-sdk-developer-extension',
    env: 'prod',
    version: packageJson.version,
    sessionPersistence: 'local-storage',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 100,
    telemetrySampleRate: 100,
    trackUserInteractions: true,
    trackViewsManually: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask',
    apiVersion: 'v1',
    organizationIdentifier: '',
    insecureHTTP: false,
  })
  openobserveRum.startSessionReplayRecording()
  openobserveRum.startView(DEFAULT_PANEL_TAB)

  openobserveLogs.init({
    clientToken: 'pub74fd472504982beb427b647893758040',
    site: 'api.openobserve.ai',
    service: 'browser-sdk-developer-extension',
    env: 'prod',
    version: packageJson.version,
    sessionPersistence: 'local-storage',
    forwardErrorsToLogs: true,
    forwardConsoleLogs: 'all',
    forwardReports: 'all',
    sessionSampleRate: 100,
    telemetrySampleRate: 100,
    apiVersion: '',
    organizationIdentifier: '',
    insecureHTTP: false,
  })
}
