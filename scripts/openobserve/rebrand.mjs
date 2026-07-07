#!/usr/bin/env node
/**
 * OpenObserve rebrand codemod.
 *
 * Transforms a pristine DataDog/browser-sdk tree into the OpenObserve-branded
 * equivalent by applying the ordered rules in rename-map.json to every tracked
 * text file, then normalizing package versions from lerna.json.
 *
 * Run from the repository root:
 *   node scripts/openobserve/rebrand.mjs [--check]
 *
 * --check: exit 1 if any file WOULD change (used to detect an already-branded tree).
 *
 * This script is deterministic and idempotent: running it twice produces the
 * same tree. It is the first step of scripts/openobserve/sync-upstream.sh.
 */
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = process.cwd()
const HERE = path.dirname(fileURLToPath(import.meta.url))
const CHECK = process.argv.includes('--check')

const { rules } = JSON.parse(fs.readFileSync(path.join(HERE, 'rename-map.json'), 'utf8'))

// Fork-owned files (keep-ours overlay) are never rebranded: they are authored for the
// fork already, and may intentionally reference upstream (e.g. the sync workflow's
// upstream remote URL).
const keepOursPaths = fs
  .readFileSync(path.join(HERE, 'keep-ours.txt'), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))

// Files never touched by the codemod.
const SKIP = [
  /^\.yarn\//,
  /^yarn\.lock$/,
  /^CHANGELOG\.md$/,
  /^rum-events-format$/, // git submodule (gitlink, not a file)
  /^scripts\/openobserve\//, // this tooling
  /^openobserve-patches\//, // the functional patch series
  /\.(png|jpg|jpeg|gif|ico|woff2?|ttf|eot|mp4|webm|zip|jar|pdf)$/i,
]

const trackedFiles = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
  .toString('utf8')
  .split('\0')
  .filter(Boolean)
  .filter((f) => !SKIP.some((re) => re.test(f)))
  .filter((f) => !keepOursPaths.some((p) => f === p || f.startsWith(`${p}/`)))

const compiled = rules.map((rule) => ({
  ...rule,
  matcher: rule.regex ? new RegExp(rule.regex, 'g') : null,
}))

function applyRules(content) {
  let out = content
  for (const rule of compiled) {
    if (rule.matcher) {
      out = out.replace(rule.matcher, rule.to)
    } else {
      out = out.split(rule.literal).join(rule.to)
    }
  }
  return out
}

let changed = 0
for (const file of trackedFiles) {
  const abs = path.join(ROOT, file)
  let stat
  try {
    stat = fs.lstatSync(abs)
  } catch {
    continue // deleted in working tree
  }
  if (!stat.isFile()) continue
  const buf = fs.readFileSync(abs)
  if (buf.includes(0)) continue // binary safety net
  const content = buf.toString('utf8')
  const next = applyRules(content)
  if (next !== content) {
    changed++
    if (!CHECK) fs.writeFileSync(abs, next)
  }
}

// ---- Version normalization -------------------------------------------------
// Workspace packages keep the OpenObserve version line (from lerna.json, which
// is a keep-ours file), not upstream's. Inter-package dependency ranges are
// pinned to the same version, mirroring upstream's exact-pin convention.
const lerna = JSON.parse(fs.readFileSync(path.join(ROOT, 'lerna.json'), 'utf8'))
const VERSION = lerna.version

let versionChanged = 0
for (const file of trackedFiles.filter((f) => f.endsWith('package.json'))) {
  const abs = path.join(ROOT, file)
  if (!fs.existsSync(abs)) continue
  const raw = fs.readFileSync(abs, 'utf8')
  const pkg = JSON.parse(raw)
  let touched = false

  if (typeof pkg.name === 'string' && pkg.name.startsWith('@openobserve/') && pkg.version) {
    if (pkg.version !== VERSION) {
      pkg.version = VERSION
      touched = true
    }
  }
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const deps = pkg[section]
    if (!deps) continue
    for (const dep of Object.keys(deps)) {
      if (dep.startsWith('@openobserve/') && /^\d/.test(deps[dep]) && deps[dep] !== VERSION) {
        deps[dep] = VERSION
        touched = true
      }
    }
  }
  if (touched) {
    versionChanged++
    if (!CHECK) fs.writeFileSync(abs, `${JSON.stringify(pkg, null, 2)}\n`)
  }
}

// ---- rum-events-format schema pin ------------------------------------------
// The schema package is the OpenObserve fork (its schemas describe `_oo`, not `_dd`),
// pinned to a controlled fork commit rather than the DataDog commit upstream ships.
// The commit lives in scripts/openobserve/rum-events-format-pin.txt and is bumped after
// an rum-events-format fork sync merges. Rewrite the root package.json entry
// deterministically so it survives every upstream sync regardless of the SHA upstream pins.
let schemaPinChanged = 0
const SCHEMA_PIN_FILE = path.join(HERE, 'rum-events-format-pin.txt')
if (fs.existsSync(SCHEMA_PIN_FILE)) {
  const pin = fs.readFileSync(SCHEMA_PIN_FILE, 'utf8').trim()
  const rootPkgPath = path.join(ROOT, 'package.json')
  const rootRaw = fs.readFileSync(rootPkgPath, 'utf8')
  const canonical = `"@openobserve/rum-events-format": "openobserve/rum-events-format#commit=${pin}"`
  const next = rootRaw.replace(/"@(?:datadog|openobserve)\/rum-events-format":\s*"[^"]+"/, canonical)
  if (next !== rootRaw) {
    schemaPinChanged = 1
    if (!CHECK) fs.writeFileSync(rootPkgPath, next)
  }
}

const total = changed + versionChanged + schemaPinChanged
console.log(
  `rebrand: ${changed} files rebranded, ${versionChanged} package.json versions normalized to ${VERSION}` +
    (schemaPinChanged ? ', rum-events-format pinned to fork' : '')
)
if (CHECK && total > 0) {
  console.error('rebrand --check: tree is not fully branded')
  process.exit(1)
}
