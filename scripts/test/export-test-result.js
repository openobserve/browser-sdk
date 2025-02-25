'use strict'

const { printLog, runMain } = require('../lib/execution-utils')
const { command } = require('../lib/command')
const { getOrg2ApiKey } = require('../lib/secrets')

/**
 * Upload test result to openobserve
 * Usage:
 * node export-test-result.js testType
 */

const testType = process.argv[2]
const resultFolder = `test-report/${testType}/`

runMain(() => {
  command`openobserve-ci junit upload --service browser-sdk --env ci --tags test.type:${testType} ${resultFolder}`
    .withEnvironment({
      OPENOBSERVE_API_KEY: getOrg2ApiKey(),
    })
    .run()

  printLog(`Export ${testType} tests done.`)
})
