import type { Reporter } from '@playwright/test/reporter'
import { getRunId } from '../envUtils'
import { APPLICATION_ID } from './lib/helpers/configuration'

// eslint-disable-next-line import-x/no-default-export
export default class NoticeReporter implements Reporter {
  onBegin() {
    console.log(
      `[RUM events] https://api.openobserve.ai/rum/explorer?query=${encodeURIComponent(
        `@application.id:${APPLICATION_ID} @context.run_id:"${getRunId()}"`
      )}`
    )
    console.log(`[Log events] https://api.openobserve.ai/logs?query=${encodeURIComponent(`@run_id:"${getRunId()}"`)}\n`)
  }
}
