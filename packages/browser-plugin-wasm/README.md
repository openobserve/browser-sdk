# WebAssembly Browser SDK plugin

The Datadog WebAssembly plugin enriches RUM and Logs errors with WebAssembly module metadata so
they can be symbolicated with the matching debug symbols.

## Setup

Register a plugin instance when initializing RUM, Logs, or both:

```js
import { wasmPlugin } from '@openobserve/browser-plugin-wasm'
import { openobserveRum } from '@openobserve/browser-rum'
import { openobserveLogs } from '@openobserve/browser-logs'

openobserveRum.init({
  // ...
  plugins: [wasmPlugin()],
})

openobserveLogs.init({
  // ...
  plugins: [wasmPlugin()],
})
```

Use package versions that match the RUM and Logs SDK versions.
