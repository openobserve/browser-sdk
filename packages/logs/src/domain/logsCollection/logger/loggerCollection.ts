import type { TimeStamp } from '@openobserve/browser-core'
import { includes, display, combine, ErrorSource, timeStampNow } from '@openobserve/browser-core'
import type { CommonContext } from '../../../rawLogsEvent.types'
import type { LifeCycle } from '../../lifeCycle'
import { LifeCycleEventType } from '../../lifeCycle'
import type { Logger, LogsMessage } from '../../logger'
import { StatusType, HandlerType } from '../../logger'

export const STATUS_PRIORITIES: { [key in StatusType]: number } = {
  [StatusType.debug]: 0,
  [StatusType.info]: 1,
  [StatusType.warn]: 2,
  [StatusType.error]: 3,
}

export function startLoggerCollection(lifeCycle: LifeCycle) {
  function handleLog(
    logsMessage: LogsMessage,
    logger: Logger,
    savedCommonContext?: CommonContext,
    savedDate?: TimeStamp
  ) {
    const messageContext = logsMessage.context

    if (isAuthorized(logsMessage.status, HandlerType.console, logger)) {
      display(logsMessage.status, logsMessage.message, combine(logger.getContext(), messageContext))
    }

    lifeCycle.notify(LifeCycleEventType.RAW_LOG_COLLECTED, {
      rawLogsEvent: {
        date: savedDate || timeStampNow(),
        message: logsMessage.message,
        status: logsMessage.status,
        origin: ErrorSource.LOGGER,
      },
      messageContext,
      savedCommonContext,
      logger,
    })
  }

  return {
    handleLog,
  }
}

export function isAuthorized(status: StatusType, handlerType: HandlerType, logger: Logger) {
  const loggerHandler = logger.getHandler()
  const sanitizedHandlerType = Array.isArray(loggerHandler) ? loggerHandler : [loggerHandler]
  return (
    STATUS_PRIORITIES[status] >= STATUS_PRIORITIES[logger.getLevel()] && includes(sanitizedHandlerType, handlerType)
  )
}
