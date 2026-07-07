# Browser Log Collection

Send logs to Datadog from web browser pages with the browser logs SDK.

See the [dedicated datadog documentation][1] for more details.

## Usage

After adding [`@openobserve/browser-logs`][2] to your `package.json` file, initialize it with:

```javascript
import { openobserveLogs } from '@openobserve/browser-logs'

openobserveLogs.init({
  clientToken: '<OPENOBSERVE_CLIENT_TOKEN>',
  site: '<OPENOBSERVE_SITE>',
  forwardErrorsToLogs: true,
  sessionSampleRate: 100,
})
```

After the Datadog browser logs SDK is initialized, send custom log entries directly to Datadog:

```javascript
import { openobserveLogs } from '@openobserve/browser-logs'

openobserveLogs.logger.info('Button clicked', { name: 'buttonName', id: 123 })

try {
  ...
  throw new Error('Wrong behavior')
  ...
} catch (ex) {
  openobserveLogs.logger.error('Error occurred', { team: 'myTeam' }, ex)
}
```

<!-- Note: all URLs should be absolute -->

[1]: https://docs.datadoghq.com/logs/log_collection/javascript
[2]: https://www.npmjs.com/package/@openobserve/browser-logs
