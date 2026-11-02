import type { ErrorInfo } from 'react'
import type { Context } from '@openobserve/js-core/util'
import { clocksNow } from '@openobserve/js-core/time'
import { callMonitored } from '@openobserve/js-core/monitor'
import { createHandlingStack } from '@openobserve/browser-core'
import { onRumStart } from '../reactPlugin'

/**
 * Add a React error to the RUM session.
 *
 * @category Error
 * @example
 * ```ts
 * import { createRoot } from 'react-dom/client'
 * import { openobserveRum } from '@openobserve/browser-rum'
 * import { addReactError } from '@openobserve/browser-rum-react'
 *
 * const container = document.getElementById('root')
 * const root = createRoot(container, {
 *   onUncaughtError: (error, errorInfo) => {
 *     // Report uncaught errors to Datadog
 *     addReactError(error, errorInfo)
 *   }
 * })
 * // ...
 * ```
 */
export function addReactError(error: unknown, info: ErrorInfo) {
  const handlingStack = createHandlingStack('react error')
  const startClocks = clocksNow()
  onRumStart((addError) => {
    callMonitored(() => {
      addError({
        error,
        handlingStack,
        componentStack: info.componentStack ?? undefined,
        startClocks,
        context: {
          ...(typeof error === 'object' && error !== null ? (error as { dd_context?: Context }).dd_context : undefined),
          framework: 'react',
        },
      })
    })
  })
}
