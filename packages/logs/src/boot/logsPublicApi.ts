import type { Context, InitConfiguration, User } from '@openobserve/browser-core'
import {
  CustomerDataType,
  assign,
  BoundedBuffer,
  createContextManager,
  makePublicApi,
  monitor,
  display,
  deepClone,
  canUseEventBridge,
  timeStampNow,
  checkUser,
  sanitizeUser,
  sanitize,
} from '@openobserve/browser-core'
import type { LogsInitConfiguration } from '../domain/configuration'
import { validateAndBuildLogsConfiguration } from '../domain/configuration'
import type { HandlerType, StatusType, LogsMessage } from '../domain/logger'
import { Logger } from '../domain/logger'
import type { CommonContext } from '../rawLogsEvent.types'
import type { startLogs } from './startLogs'

export interface LoggerConfiguration {
  level?: StatusType
  handler?: HandlerType | HandlerType[]
  context?: object
}

export type LogsPublicApi = ReturnType<typeof makeLogsPublicApi>

export type StartLogs = typeof startLogs

type StartLogsResult = ReturnType<typeof startLogs>

export function makeLogsPublicApi(startLogsImpl: StartLogs) {
  let isAlreadyInitialized = false

  const globalContextManager = createContextManager(CustomerDataType.GlobalContext)
  const userContextManager = createContextManager(CustomerDataType.User)

  const customLoggers: { [name: string]: Logger | undefined } = {}
  let getInternalContextStrategy: StartLogsResult['getInternalContext'] = () => undefined

  const beforeInitLoggerLog = new BoundedBuffer()

  let handleLogStrategy: StartLogsResult['handleLog'] = (
    logsMessage: LogsMessage,
    logger: Logger,
    savedCommonContext = deepClone(buildCommonContext()),
    date = timeStampNow()
  ) => {
    beforeInitLoggerLog.add(() => handleLogStrategy(logsMessage, logger, savedCommonContext, date))
  }

  let getInitConfigurationStrategy = (): InitConfiguration | undefined => undefined
  const mainLogger = new Logger((...params) => handleLogStrategy(...params))

  function buildCommonContext(): CommonContext {
    return {
      view: {
        referrer: document.referrer,
        url: window.location.href,
      },
      context: globalContextManager.getContext(),
      user: userContextManager.getContext(),
    }
  }

  return makePublicApi({
    logger: mainLogger,

    init: monitor((initConfiguration: LogsInitConfiguration) => {
      // This function should be available, regardless of initialization success.
      getInitConfigurationStrategy = () => deepClone(initConfiguration)

      if (canUseEventBridge()) {
        initConfiguration = overrideInitConfigurationForBridge(initConfiguration)
      }

      if (!canInitLogs(initConfiguration)) {
        return
      }

      const configuration = validateAndBuildLogsConfiguration(initConfiguration)
      if (!configuration) {
        return
      }

      ; ({ handleLog: handleLogStrategy, getInternalContext: getInternalContextStrategy } = startLogsImpl(
        initConfiguration,
        configuration,
        buildCommonContext,
        mainLogger
      ))

      beforeInitLoggerLog.drain()

      isAlreadyInitialized = true
    }),

    /** @deprecated: use getGlobalContext instead */
    getLoggerGlobalContext: monitor(globalContextManager.get),
    getGlobalContext: monitor(globalContextManager.getContext),

    /** @deprecated: use setGlobalContext instead */
    setLoggerGlobalContext: monitor(globalContextManager.set),
    setGlobalContext: monitor(globalContextManager.setContext),

    /** @deprecated: use setGlobalContextProperty instead */
    addLoggerGlobalContext: monitor(globalContextManager.add),
    setGlobalContextProperty: monitor(globalContextManager.setContextProperty),

    /** @deprecated: use removeGlobalContextProperty instead */
    removeLoggerGlobalContext: monitor(globalContextManager.remove),
    removeGlobalContextProperty: monitor(globalContextManager.removeContextProperty),

    clearGlobalContext: monitor(globalContextManager.clearContext),

    createLogger: monitor((name: string, conf: LoggerConfiguration = {}) => {
      customLoggers[name] = new Logger(
        (...params) => handleLogStrategy(...params),
        sanitize(name),
        conf.handler,
        conf.level,
        sanitize(conf.context) as object
      )

      return customLoggers[name]!
    }),

    getLogger: monitor((name: string) => customLoggers[name]),

    getInitConfiguration: monitor(() => getInitConfigurationStrategy()),

    getInternalContext: monitor((startTime?: number | undefined) => getInternalContextStrategy(startTime)),

    setUser: monitor((newUser: User) => {
      if (checkUser(newUser)) {
        userContextManager.setContext(sanitizeUser(newUser as Context))
      }
    }),

    getUser: monitor(userContextManager.getContext),

    setUserProperty: monitor((key, property) => {
      const sanitizedProperty = sanitizeUser({ [key]: property })[key]
      userContextManager.setContextProperty(key, sanitizedProperty)
    }),

    removeUserProperty: monitor(userContextManager.removeContextProperty),

    clearUser: monitor(userContextManager.clearContext),
  })

  function overrideInitConfigurationForBridge<C extends InitConfiguration>(initConfiguration: C): C {
    return assign({}, initConfiguration, { clientToken: 'empty' })
  }

  function canInitLogs(initConfiguration: LogsInitConfiguration) {
    if (isAlreadyInitialized) {
      if (!initConfiguration.silentMultipleInit) {
        display.error('OO_LOGS is already initialized.')
      }
      return false
    }
    return true
  }
}
