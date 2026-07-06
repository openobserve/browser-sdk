# Upstream sync

This repository is a fork of [DataDog/browser-sdk](https://github.com/DataDog/browser-sdk),
rebuilt from upstream release tags instead of merged. The openobserve branch is **generated**:

```
upstream tag  →  keep-ours overlay  →  rebrand codemod  →  lockfile  →  functional patches
```

The only manual step in the normal flow is approving the sync PR.

## Components

| Piece | Purpose |
| --- | --- |
| `scripts/openobserve/rename-map.json` | Ordered rename rules (package names, globals, `_dd`→`_oo`, intake params, …) |
| `scripts/openobserve/rebrand.mjs` | Applies the map to every tracked text file + normalizes package versions from `lerna.json` |
| `scripts/openobserve/keep-ours.txt` | Fork-owned paths always taken from the `openobserve` branch (README, `.github/`, this tooling, …) |
| `openobserve-patches/*.patch` | The real functional customizations, applied with `git am -3` |
| `scripts/openobserve/UPSTREAM_BASE` | The upstream tag the branch is currently built from |
| `scripts/openobserve/sync-upstream.sh` | Orchestrates the pipeline, produces a `sync/upstream-<tag>` branch |
| `.github/workflows/sync-upstream.yml` | Monthly cron + manual dispatch; runs the script, typechecks, builds, opens the PR |

## The functional patches

1. **0001 intake endpoint** — `apiVersion`, `organizationIdentifier`, `insecureHTTP` init options;
   intake path `/rum/{apiVersion}/{org}/{trackType}`; `site` used verbatim as host; Datadog site
   validation removed.
2. **0002 W3C trace context** — 128-bit UUIDv7 trace ids (inline, no dependency); reuse of an
   existing valid `traceparent` header (continue the app's trace instead of starting a new one);
   tracing headers replace pre-existing ones instead of appending; `'openobserve'` accepted as an
   alias of the `'datadog'` propagator; default propagators = `['tracecontext']`; trace/span ids
   serialized as hex in resource events.
3. **0003 console URLs** — session replay deep links use the configured site verbatim;
   developer-extension intake detection uses OpenObserve domains.

The event schemas come from the **OpenObserve fork** `@openobserve/rum-events-format`
([openobserve/rum-events-format](https://github.com/openobserve/rum-events-format)), whose schemas
describe `_oo` directly — so unit tests validate events against them with no `_oo`→`_dd` shim (the
former patch 0004 is gone). The fork commit is pinned in
`scripts/openobserve/rum-events-format-pin.txt`; `rebrand.mjs` rewrites the `package.json` entry to
that pin on every sync, so upstream's DataDog SHA is never inherited. After an rum-events-format
fork sync merges, bump the pin: `yarn openobserve:schemas --update <fork-commit>` (or edit the pin
file), then `yarn install`.

## Release cadence policy

- **Minors/patches of the current major**: synced automatically by the monthly cron.
- **Majors**: never automatic. The workflow opens an issue when a new major exists; dispatch the
  workflow manually with `allow_major: true` after reading the upstream migration guide. Expect to
  re-port one or more patches (`git am` will stop on conflict; fix, `git am --continue`, then
  refresh the series with `git format-patch --zero-commit -o openobserve-patches <base>..HEAD^`).
- Prefer syncing to **tags**, not `upstream/main`.

## Running locally

```bash
bash scripts/openobserve/sync-upstream.sh           # latest tag of current major
bash scripts/openobserve/sync-upstream.sh v7.5.0    # explicit tag
ALLOW_MAJOR=1 bash scripts/openobserve/sync-upstream.sh
```

Then: `yarn typecheck && yarn build && yarn test:unit`, push the branch, open a PR against
`openobserve`.

## Known-failing unit test suites

Upstream specs that assert Datadog-specific behavior we intentionally change are expected to fail
until they are aligned (deferred): `endpointBuilder.spec`, `configuration.spec` (core + rum-core,
1 case each), `remoteConfiguration.spec`, `quotaCheck.spec`, `tracer.spec`, `identifier.spec`,
`resourceCollection.spec` (tracing info cases), `getSessionReplayUrl.spec`,
`getSessionReplayLink.spec` (rum + rum-slim), `startLogs.spec` (1 case), developer-extension
`copyEvent.spec`. Everything else must pass — a failure outside this list after a sync indicates a
real regression.

## Editing the customizations

- **Branding change** → edit `rename-map.json` (order matters: specific rules before generic).
- **Behavior change** → edit code on a sync branch (or `openobserve`), then regenerate the patch
  series from the feature commits: `git format-patch --zero-commit -o openobserve-patches <rebrand-commit>..HEAD`.
- **New fork-owned file** → add its path to `keep-ours.txt`.
