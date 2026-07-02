# OpenObserve Browser SDK

Collect and send browser data to OpenObserve for logs and Real User Monitoring (RUM).

## Overview

The OpenObserve Browser SDK provides a comprehensive solution for monitoring your web applications. It includes packages for log collection, real user monitoring, and performance tracking directly from the browser.

## Installation

### Using npm

```bash
# For logs collection
npm install @openobserve/browser-logs

# For RUM (Real User Monitoring)
npm install @openobserve/browser-rum

# For RUM Slim (lighter version without session replay)
npm install @openobserve/browser-rum-slim
```

For detailed setup instructions and configuration options, see the [OpenObserve RUM Setup Guide](https://openobserve.ai/docs/user-guide/rum/#setup).

### Using CDN

You can include the SDK directly in your HTML using our CDN:

```html
<!-- For logs collection -->
<script src="https://browsersdk.openobserve.ai/0.3.4/openobserve-logs.js"></script>

<!-- For RUM -->
<script src="https://browsersdk.openobserve.ai/0.3.4/openobserve-rum.js"></script>

<!-- For RUM Slim -->
<script src="https://browsersdk.openobserve.ai/0.3.4/openobserve-rum-slim.js"></script>
```

## CDN Bundles

OpenObserve provides CDN bundles based on version:

| Version | Logs                                                                               | RUM                                                                              | RUM Slim                                                                                   |
| ------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 0.3.4   | [openobserve-logs.js](https://browsersdk.openobserve.ai/0.3.4/openobserve-logs.js) | [openobserve-rum.js](https://browsersdk.openobserve.ai/0.3.4/openobserve-rum.js) | [openobserve-rum-slim.js](https://browsersdk.openobserve.ai/0.3.4/openobserve-rum-slim.js) |

## Getting Started

### Log Collection

The OpenObserve Browser Logs package allows you to collect and forward logs from your browser application to OpenObserve. It supports multiple log levels, custom context, and automatic error tracking.

See the dedicated OpenObserve Browser Log Collection documentation to learn how to configure and use log collection.

### Real User Monitoring

The OpenObserve Browser RUM packages enable you to collect real user monitoring data including page views, user interactions, errors, and performance metrics from your browser application.

**Choose the right package:**

- **@openobserve/browser-rum**: Full RUM package with session replay capabilities
- **@openobserve/browser-rum-slim**: Lighter version without session replay (recommended for smaller bundle sizes)

See the dedicated OpenObserve Browser RUM Collection documentation to learn how to configure and use RUM.

## Packages

This repository contains several packages available on npm:

| Package                                            | Version | Description                                           | npm Link                                                           |
| -------------------------------------------------- | ------- | ----------------------------------------------------- | ------------------------------------------------------------------ |
| [@openobserve/browser-logs](packages/logs)         | 0.3.4   | Browser log collection                                | [npm](https://www.npmjs.com/package/@openobserve/browser-logs)     |
| [@openobserve/browser-rum](packages/rum)           | 0.3.4   | Real User Monitoring with session replay              | [npm](https://www.npmjs.com/package/@openobserve/browser-rum)      |
| [@openobserve/browser-rum-slim](packages/rum-slim) | 0.3.4   | Real User Monitoring (lightweight, no session replay) | [npm](https://www.npmjs.com/package/@openobserve/browser-rum-slim) |
| [@openobserve/browser-rum-core](packages/rum-core) | 0.3.4   | Core RUM functionality (internal package)             | [npm](https://www.npmjs.com/package/@openobserve/browser-rum-core) |
| [@openobserve/browser-core](packages/core)         | 0.3.4   | Core utilities (internal package)                     | [npm](https://www.npmjs.com/package/@openobserve/browser-core)     |

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Attribution

This project is based on the [Datadog Browser SDK](https://github.com/DataDog/browser-sdk) and includes modifications by Zinc Labs Inc. (OpenObserve). We are grateful to Datadog for their original work and open-source contribution.
