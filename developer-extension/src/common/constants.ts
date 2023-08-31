export const DEV_LOGS_URL = 'http://localhost:8080/openobserve-logs.js'
export const DEV_RUM_URL = 'http://localhost:8080/openobserve-rum.js'
export const DEV_RUM_SLIM_URL = 'http://localhost:8080/openobserve-rum-slim.js'

export const INTAKE_DOMAINS = [
  'api.openobserve.ai',
]

export const enum PanelTabs {
  Events = 'events',
  Infos = 'infos',
  Settings = 'settings',
  Replay = 'replay',
}

export const DEFAULT_PANEL_TAB = PanelTabs.Events
