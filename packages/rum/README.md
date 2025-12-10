# RUM Browser Monitoring

Openobserve Real User Monitoring (RUM) enables you to visualize and analyze the real-time performance and user journeys of your application's individual users.

## Usage

To start collecting events, add [`@openobserve/browser-rum`][1] to your `package.json` file, then initialize it with:

```javascript
import { openobserveRum } from '@openobserve/browser-rum'

openobserveRum.init({
  applicationId: '<OPENOBSERVE_APPLICATION_ID>',
  clientToken: '<OPENOBSERVE_CLIENT_TOKEN>',
  site: '<OPENOBSERVE_SITE>',
  organizationIdentifier: '<OPENOBSERVE_ORGANIZATION_IDENTIFIER>',
  service: 'my-web-application',
  env: 'production',
  version: '1.0.0',
  sessionSampleRate: 100,
  sessionReplaySampleRate: 100,
  trackResources: true,
  trackLongTasks: true,
  trackUserInteractions: true,
  apiVersion: 'v1',
  insecureHTTP: false,
})
```

**Note**: 
1. The `trackUserInteractions` parameter enables the automatic collection of user clicks in your application.
2. In some scenarios, you may want to begin recording, even if it was initially sampled out of replay. To force Session Replay recording for the rest of the current session, call startSessionReplayRecording({ force: true })
**Sensitive and private data** contained in your pages may be included to identify the elements interacted with.

<!-- Note: all URLs should be absolute -->

[1]: https://www.npmjs.com/package/@openobserve/browser-rum
