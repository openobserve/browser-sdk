# Browser Log Collection

Send logs to OpenObserve from web browser pages with the browser logs SDK.

See the [OpenObserve RUM documentation][1] for more details.

## Usage

After adding [`@openobserve/browser-logs`][2] to your `package.json` file, initialize it with:

```javascript
import { openobserveLogs } from '@openobserve/browser-logs'

openobserveLogs.init({
  clientToken: '<OPENOBSERVE_CLIENT_TOKEN>',
  site: '<OPENOBSERVE_SITE>',
  organizationIdentifier: '<OPENOBSERVE_ORGANIZATION_IDENTIFIER>',
  forwardErrorsToLogs: true,
  sessionSampleRate: 100,
})
```

After the OpenObserve browser logs SDK is initialized, send custom log entries directly to OpenObserve:

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

## CDN

The bundle is also served from the OpenObserve CDN:

```html
<script src="https://browsersdk.openobserve.ai/<VERSION>/openobserve-logs.js"></script>
```

<!-- Note: all URLs should be absolute -->

[1]: https://openobserve.ai/docs/user-guide/rum/
[2]: https://www.npmjs.com/package/@openobserve/browser-logs
