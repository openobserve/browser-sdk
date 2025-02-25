import * as path from 'path'

const ROOT = path.join(__dirname, '../../../..')
export const RUM_BUNDLE = path.join(ROOT, 'packages/rum/bundle/openobserve-rum.js')
export const RUM_SLIM_BUNDLE = path.join(ROOT, 'packages/rum-slim/bundle/openobserve-rum-slim.js')
export const LOGS_BUNDLE = path.join(ROOT, 'packages/logs/bundle/openobserve-logs.js')
export const WORKER_BUNDLE = path.join(ROOT, 'packages/worker/bundle/worker.js')
export const NPM_BUNDLE = path.join(ROOT, 'test/app/dist/app.js')
