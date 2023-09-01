import { defineGlobal, getGlobalObject } from '@openobserve/browser-core'
import type { LogsPublicApi } from '../boot/logsPublicApi'
import { makeLogsPublicApi } from '../boot/logsPublicApi'
import { startLogs } from '../boot/startLogs'

export { Logger, LogsMessage, StatusType, HandlerType } from '../domain/logger'
export { LoggerConfiguration, LogsPublicApi as LogsGlobal } from '../boot/logsPublicApi'
export { LogsInitConfiguration } from '../domain/configuration'
export { LogsEvent } from '../logsEvent.types'

export const openobserveLogs = makeLogsPublicApi(startLogs)

interface BrowserWindow extends Window {
  OO_LOGS?: LogsPublicApi
}
defineGlobal(getGlobalObject<BrowserWindow>(), 'OO_LOGS', openobserveLogs)
