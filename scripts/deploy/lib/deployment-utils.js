const packages = [
  { packageName: 'logs', service: 'browser-logs-sdk' },
  { packageName: 'rum', service: 'browser-rum-sdk' },
  { packageName: 'rum-slim', service: 'browser-rum-sdk' },
]

// ex: openobserve-rum-v4.js
const buildRootUploadPath = (packageName, version, extension = 'js') => `openobserve-${packageName}-${version}.${extension}`

// ex: us1/v4/openobserve-rum.js
const buildDatacenterUploadPath = (datacenter, packageName, version, extension = 'js') =>
  `${datacenter}/${version}/openobserve-${packageName}.${extension}`

// ex: openobserve-rum.js
const buildBundleFileName = (packageName, extension = 'js') => `openobserve-${packageName}.${extension}`

// ex: packages/rum/bundle
const buildBundleFolder = (packageName) => `packages/${packageName}/bundle`

module.exports = {
  packages,
  buildRootUploadPath,
  buildDatacenterUploadPath,
  buildBundleFileName,
  buildBundleFolder,
}
