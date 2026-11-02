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
| `scripts/openobserve/rename-map.json` | Ordered rename rules (package names, globals, `_dd`→`_o2`, intake params, …) |
| `scripts/openobserve/rebrand.mjs` | Applies the map to every tracked text file + normalizes package versions from `lerna.json` |
| `scripts/openobserve/keep-ours.txt` | Fork-owned paths always taken from the `openobserve` branch (README, `.github/`, this tooling, …) |
| `openobserve-patches/*.patch` | The real functional customizations, applied with `git am -3 --keep-cr` (some upstream files are CRLF) |
| `scripts/openobserve/UPSTREAM_BASE` | The upstream tag the branch is currently built from |
| `scripts/openobserve/sync-upstream.sh` | Orchestrates the pipeline, produces a `sync/upstream-<tag>` branch |
| `.github/workflows/sync-upstream.yml` | Monthly cron + manual dispatch; runs the script, typechecks, builds, opens the PR |

## The functional patches

1. **0001 intake endpoint** — `apiVersion`, `organizationIdentifier`, `insecureHTTP` init options;
   intake path `/rum/{apiVersion}/{org}/{trackType}`; `site` used verbatim as host; Datadog site
   validation removed. Since upstream v7.7 the configuration is schema-driven
   (`BROWSER_CORE_SCHEMA`): a key that is not declared in the schema is silently dropped, so the three
   options are declared there (`site` is a plain `string` field, not upstream's `site` type, which
   rejects non-Datadog hosts), as well as in `InitConfiguration`.
2. **0002 W3C trace context** — 128-bit UUIDv7 trace ids (inline, no dependency); reuse of an
   existing valid `traceparent` header (continue the app's trace instead of starting a new one);
   tracing headers replace pre-existing ones instead of appending; `'openobserve'` accepted as an
   alias of the `'datadog'` propagator; default propagators = `['tracecontext']`; trace/span ids
   serialized as hex in resource events. `'openobserve'` is also listed in the `allowedTracingUrls`
   `propagatorTypes` enum of the rum-core configuration schema (an unlisted value is dropped).
3. **0003 console URLs** — session replay deep links use the configured site verbatim;
   developer-extension intake detection uses OpenObserve domains.
4. **0004 partial view updates default off** — `betaEnableViewUpdates` defaults to `false`
   (upstream: `true` unless a `proxy` is set or the bundle is Salesforce) because the OpenObserve
   server does not handle the `view_update` event type. An explicit `true` is still honoured; the
   event bridge still forces it off.
5. **0005 fixed-width hex trace/span ids** — `_o2.trace_id` / `_o2.span_id` in resource events and
   the `x-openobserve-*` headers use fixed-width hex (32 / 16 chars), and the header is
   `x-openobserve-span-id`, as the backend expects (openobserve/browser-sdk#25).
6. **0006 session store key `_o2_s_v3`** — `SESSION_STORE_KEY = '_o2_s_v3'`,
   `LEGACY_SESSION_STORE_KEY = '_oo_s_v2'` (o2-enterprise#2724).
7. **0007 CDN content type** — `scripts/deploy` uploads bundles with `--content-type text/javascript`
   (openobserve/browser-sdk#29).

Patches 0005-0007 were commits made directly on the `openobserve` branch after the original patch
series (0001-0003) was written. They were not in `openobserve-patches/`, so a sync would have
silently dropped them: **any change committed straight to `openobserve` outside the keep-ours paths
must also be added to `openobserve-patches/`, or the next sync reverts it.** To check for such drift,
rebuild the current base (tag in `UPSTREAM_BASE`) with the steps of `sync-upstream.sh` and diff the
result against `openobserve`.

The event schemas come from the **OpenObserve fork** `@openobserve/rum-events-format`
([openobserve/rum-events-format](https://github.com/openobserve/rum-events-format)), whose schemas
describe `_o2` directly — so unit tests validate events against them with no `_o2`→`_dd` shim (the
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
UPSTREAM_REMOTE=datadog bash scripts/openobserve/sync-upstream.sh v7.5.0   # remote not named `upstream`
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
`copyEvent.spec`, js-core `configuration.spec` (1 case, asserts the `docs.datadoghq.com` link in the
invalid-site message). The `resourceCollection.spec` cases that validate a traced event also fail
while `@openobserve/rum-events-format` still requires decimal `trace_id`/`span_id` (pattern
`^[0-9]+$`); they pass once the schema fork accepts hex. Everything else must pass — a failure outside this list after a sync indicates a
real regression.

## Editing the customizations

- **Branding change** → edit `rename-map.json` (order matters: specific rules before generic).
- **Behavior change** → edit code on a sync branch (or `openobserve`), then regenerate the patch
  series from the feature commits: `git format-patch --zero-commit -o openobserve-patches <rebrand-commit>..HEAD`.
- **New fork-owned file** → add its path to `keep-ours.txt`.
