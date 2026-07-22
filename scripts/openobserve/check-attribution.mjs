#!/usr/bin/env node
/**
 * Attribution gate for the upstream-sync pipeline (Apache-2.0 §4 compliance).
 *
 * Fails the sync if the rebrand erased upstream (Datadog) attribution:
 *   - any file where the per-file license header was mutated to
 *     "developed at OpenObserve" (the header must stay "developed at Datadog"), or
 *   - a NOTICE that no longer carries the required Datadog attribution, or
 *   - a missing NOTICE.
 *
 * The rebrand keeps attribution via scripts/openobserve/rebrand.mjs (ATTRIBUTION_RE),
 * and the OpenObserve modification statement lives in NOTICE + README. This gate is
 * the backstop that makes a regression impossible to merge unnoticed.
 *
 * Usage (run from a fork repo root, after rebrand + patches):
 *   node scripts/openobserve/check-attribution.mjs
 * Exit 0 = attribution intact, 1 = violation.
 */
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const SKIP = [
  /(^|\/)\.git\//,
  /(^|\/)node_modules\//,
  /(^|\/)build\//,
  /(^|\/)\.build\//,
  /^scripts\/openobserve\//,
  /\.(png|jpg|jpeg|gif|ico|svg|webp|woff2?|ttf|otf|so|a|jar|aar|keystore|bin|zip|pdf|framework|xcframework|dSYM)$/i,
]

const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 256 * 1024 * 1024 })
  .toString('utf8')
  .split('\0')
  .filter(Boolean)
  .filter((f) => !SKIP.some((re) => re.test(f)))

const erased = []
for (const f of files) {
  let buf
  try {
    buf = fs.readFileSync(path.join(ROOT, f))
  } catch {
    continue
  }
  if (buf.includes(0)) continue
  if (buf.toString('utf8').includes('developed at OpenObserve')) erased.push(f)
}

const errors = []
if (erased.length) {
  errors.push(
    `Datadog license header was erased in ${erased.length} file(s) ` +
      `(found "developed at OpenObserve"; it must stay "developed at Datadog"). ` +
      `e.g. ${erased.slice(0, 5).join(', ')}`
  )
}
const noticePath = path.join(ROOT, 'NOTICE')
if (!fs.existsSync(noticePath)) {
  errors.push('NOTICE file is missing (Apache-2.0 §4(d) attribution).')
} else if (!/Datadog/.test(fs.readFileSync(noticePath, 'utf8'))) {
  errors.push('NOTICE no longer contains the required Datadog attribution.')
}

if (errors.length) {
  console.error('attribution check FAILED (Apache-2.0 §4):')
  for (const e of errors) console.error('  - ' + e)
  console.error('Fix: the rebrand must retain Datadog copyright/attribution — see the')
  console.error('     ATTRIBUTION_RE guard in scripts/openobserve/rebrand.mjs.')
  process.exit(1)
}
console.log('attribution check OK: Datadog attribution retained, NOTICE intact.')
