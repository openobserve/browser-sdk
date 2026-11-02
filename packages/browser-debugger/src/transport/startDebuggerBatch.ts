import type { InitConfiguration, Batch } from '@openobserve/browser-core'
import { createBatch } from '@openobserve/browser-core'
import { createEndpointBuilder } from '@openobserve/js-core/transport'
import { display } from '../domain/display'

export function startDebuggerBatch(initConfiguration: InitConfiguration): Batch {
  const debuggerEndpointBuilder = createEndpointBuilder({ ...initConfiguration, source: 'dd_debugger' }, 'debugger')

  return createBatch({
    endpoints: [debuggerEndpointBuilder],
    reportError: (message) => display.error('transport error:', message),
  })
}
