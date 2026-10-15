# First-visit latency: core.withsummon.com (2026-10-16)

**Question:** newly onboarded users, and users opening a workspace for the first time, find Summon Core slow. Is IndexedDB loading the cause?

**Short answer:** no. A first workspace visit opens **zero** IndexedDB databases. A first visit is slow because the browser has to fetch about 290 JS modules (1.4–1.7 MB brotli) before the app makes its first API call, and it discovers most of them one import level at a time. On a 4G-class connection, flattening that waterfall brings the first API call 340–590 ms earlier, and that is what this PR does. The serial bootstrap API chain comes after it.

## Control artifacts and claim types

| Label        | Artifact                                                                                                                                                                                                                                                                                                                    | Claim type                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **live**     | `GET https://core.withsummon.com/ai/health` → `084749d585871c2025c7e75851a0e923cca854c9` (PR #17 deployed)                                                                                                                                                                                                                  | Live, signed out, headless Chrome, n = 2–3 per row |
| **local**    | Baseline `main @ c751be59d2`, production `react-router build`, against the local API (`summon-core-system-api-1`), workspace `local-summon` (8 projects, 48 work items), user `qa-member@summon.test`. A temporary Django session was minted for the probe and deleted afterwards                                           | Local, directional                                 |
| **local h2** | Same builds served over HTTP/2 + TLS by a scratch Node server: brotli, `max-age=14400` on assets (as live), and an API proxy capped at **2 concurrent requests + 70 ms each** to reproduce `GUNICORN_WORKERS=2`. Network shaped by Chrome DevTools Protocol: _broadband_ = 40 ms RTT / 20 Mbps, _4G_ = 150 ms RTT / ~9 Mbps | Local, directional; n = 5, medians                 |

"Ready" is the time from navigation start until the page's first useful content is visible: _Active projects_ on the workspace home and work item `MMF-1` in the project's work items list. Every run used a fresh Chrome profile (empty HTTP cache, IndexedDB, and localStorage) unless marked warm.

Caveats:

- Warm runs come from the HTTP/1.1 local server, because Chrome will not cache responses from an origin with a self-signed certificate. Over HTTP/2 the "warm" profile re-downloaded everything. Cold runs on HTTP/1.1 overstate the waterfall (six connections per host), so the cold-vs-warm table below exaggerates the cold side. The fix A/B uses HTTP/2.
- Live runs are signed out. Route modules load before any auth check, so the time to the first API call measures the full cold module phase for `/<workspace>/`. Data loading after that needs a session and was measured locally.

## Ranked bottlenecks

| #   | Bottleneck                                                                                                                                                                                                                                                                                                   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Owner                                                                                                                                                                                                     | Status                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 1   | **Cold module graph is discovered serially.** The SPA's `index.html` only modulepreloads the root route. Every other matched route is loaded with a bare `import()`, and its imports are found one level at a time                                                                                           | Live 4G: **3.0 s** until the first API call cold vs **0.2 s** warm (290 modules, 1.67 MB). Local initiator trace: ~10 levels (`layout → create-project-modal → item-icon → …`). Local h2 A/B (this PR, 4G, n = 5): Summon home ready **3905 → 3340 ms**, sign-in flow **5031 → 4649 ms**, `/:slug/` **4228 → 3632 ms**                                                                                                                                                                                        | `apps/web/app/entry.client.tsx` (React Router SPA mode)                                                                                                                                                   | **Fixed in this PR**          |
| 2   | **The workspace root redirects only after the shell has loaded.** Sign-in, onboarding, invitations, and the workspace switcher send users to `/:slug`, which renders `<Navigate to="/:slug/summon">` only after the whole shell and its API chain. Then the Summon home's modules load as a second waterfall | Local h2 4G timeline: the shell's API chain ends at 3.79 s, then `summon/layout` + `summon/page` load at 3.47–3.97 s in three waves, and the home summary request starts only at 3.98 s. That is about **0.5 s** of serial module loading. With this PR, `/:slug/` still lands about 0.3 s after `/:slug/summon` (3632 vs 3340 ms, 4G). A `clientLoader` redirect was tried and did not help: it only moves that waterfall ahead of the API chain, and the ready time did not improve (500 ms-resolution run) | Workspace entry links (`getWorkspaceRedirectionUrl`, `create-workspace`, `invitations`, `workspace-invitations`, sidebar dropdown, app rail, Power K) and `app/(all)/[workspaceSlug]/(projects)/page.tsx` | Follow-up                     |
| 3   | **Every screen ships every empty-state illustration.** propel's asset registry statically imports all 48 SVG illustrations, so any `EmptyStateDetailed`/`EmptyStateCompact` pulls in a 683 KB (203 KB br) chunk                                                                                              | Largest item in the home graph: 203 KB of 1229 KB br (16%). Removing it: home **1229 → 1029 KB**, work items **1766 → 1566 KB** br; first API call 60–190 ms earlier on 4G. Ready time was not resolvable at that run's 500 ms metric resolution; it is part of the combined A/B below                                                                                                                                                                                                                        | `packages/propel/src/empty-state/assets/asset-registry.tsx`                                                                                                                                               | **Fixed in this PR**          |
| 4   | **Serial bootstrap API chain on a 2-worker API**                                                                                                                                                                                                                                                             | `instances → users/me → {profile, settings, workspaces} → 7 workspace calls → favorites/notifications → page data`. That is 1.0–1.7 s after the first API call, on warm and cold loads alike. Warm work items still take 1.9–2.4 s with 29–39 API calls                                                                                                                                                                                                                                                       | `InstanceWrapper` → `AuthenticationWrapper` → `WorkspaceAuthWrapper` gates; API worker count                                                                                                              | Follow-up                     |
| 5   | **CDN/cache headers amplify cold visits on live**                                                                                                                                                                                                                                                            | A hashed asset served on a Cloudflare `MISS` had a TTFB of **319 ms**, vs **85 ms** on a `HIT`. Every deploy re-hashes the chunks, so the first visitors per edge after a release pay the MISS. Hashed assets are served with `cache-control: max-age=14400` (4 h), without `immutable`, so a returning user after 4 h revalidates every module                                                                                                                                                               | Web container / Caddy / Cloudflare cache rules                                                                                                                                                            | Follow-up (do not touch here) |
| —   | **IndexedDB**                                                                                                                                                                                                                                                                                                | 0 `indexedDB.open` calls and 0 databases after cold and warm loads of the workspace home and project work items (instrumented `indexedDB.open`, `indexedDB.databases()`)                                                                                                                                                                                                                                                                                                                                      | —                                                                                                                                                                                                         | Not a cause                   |

Long tasks are not the problem either: 0 ms on the workspace home, and 105–125 ms in total (max 50–70 ms) on project work items, cold or warm.

## IndexedDB and local-DB inventory

| Owner                                                             | What it does                                                                                                                                                                         | First login / first workspace entry                                                                                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/editor/src/core/hooks/use-yjs-setup.ts` (`y-indexeddb`) | Caches one collaborative page's Y.Doc per `docId`. It runs in the main thread when a page editor mounts, and the editor shows a sync loader until the cache or the server has synced | Not on the home or work-items path. A first open of any page has an empty cache, so the editor waits for the server sync. Per document, not per workspace |
| `packages/services/src/indexedDB.service.ts`                      | Abstract `IndexedDBService` with a `workspaces` store                                                                                                                                | Dead code: never subclassed, and its only caller in `packages/shared-state/src/store/user.store.ts` is commented out                                      |
| `apps/web/public/sw.js` + `workbox-*.js`                          | Workbox service worker from upstream Plane                                                                                                                                           | Never registered (no `serviceWorker.register` in the app). Dead asset                                                                                     |
| Plane local issue DB (sqlite-wasm / OPFS / "syncing workspace")   | —                                                                                                                                                                                    | Not present in this fork: no sqlite-wasm, OPFS, Dexie, `idb` or workers                                                                                   |

The work items list is fetched from the API with pagination on every visit. Nothing is downloaded into a local database.

## Measurements

### Live: cold module phase (signed out, `/local-summon/`)

| Network               | Cold: first API call | Warm: first API call | Modules before first API call | Bytes (cold) |
| --------------------- | -------------------: | -------------------: | ----------------------------: | -----------: |
| Unthrottled (my link) |               619 ms |               158 ms |                           290 |      1668 KB |
| 40 ms RTT / 20 Mbps   |         1177–1265 ms |               157 ms |                           290 |      1668 KB |
| 150 ms RTT / ~9 Mbps  |         3024–3054 ms |           181–216 ms |                           290 |      1668 KB |

All assets were Cloudflare `HIT` over h2/h3. A post-deploy `MISS` adds roughly 230 ms of TTFB per uncached chunk.

### Local: cold vs warm (HTTP/1.1, baseline)

| Page               | Network         | Cold ready | Warm ready | Assets (cold/warm from cache) | Asset KB cold | API calls |
| ------------------ | --------------- | ---------: | ---------: | ----------------------------: | ------------: | --------: |
| Workspace home     | loopback        |    1381 ms |     877 ms |                     316 / 315 |          1498 |        19 |
| Workspace home     | 40 ms / 20 Mbps |    3853 ms |     870 ms |                     316 / 315 |          1498 |        19 |
| Project work items | loopback        |    2436 ms |    1870 ms |                     346 / 345 |          2359 |     29–39 |
| Project work items | 40 ms / 20 Mbps |    4927 ms |    2376 ms |                     346 / 345 |          2359 |        29 |

### Local h2: fixes, cold (n = 5 medians)

Baseline (`c751be59d2`) vs this PR (route-module preload + lazy empty-state illustrations). Both builds are cold, fresh profile, n = 5, medians. "Ready" is timestamped in the page.

| Entry                                          | Network          | Baseline ready | PR ready |                  Δ | First API call (base → PR) | FCP (base → PR) | Asset KB (base → PR) |
| ---------------------------------------------- | ---------------- | -------------: | -------: | -----------------: | -------------------------: | --------------: | -------------------: |
| `/` signed in → `/:slug/summon` (sign-in flow) | 150 ms / ~9 Mbps |        5031 ms |  4649 ms |  **−382 ms (−8%)** |             2240 → 1901 ms |  2428 → 2080 ms |          1452 → 1252 |
| `/:slug/` → `/:slug/summon`                    | 150 ms / ~9 Mbps |        4228 ms |  3632 ms | **−596 ms (−14%)** |             2836 → 2247 ms |  3004 → 2424 ms |          1439 → 1239 |
| `/:slug/summon` (direct)                       | 150 ms / ~9 Mbps |        3905 ms |  3340 ms | **−565 ms (−14%)** |             2851 → 2295 ms |  3032 → 2472 ms |          1439 → 1238 |
| Project work items                             | 150 ms / ~9 Mbps |        5495 ms |  5262 ms |      −233 ms (−4%) |             3085 → 2859 ms |  3280 → 3028 ms |          2295 → 2095 |
| `/` signed in → `/:slug/summon` (sign-in flow) | 40 ms / 20 Mbps  |        2215 ms |  2099 ms |      −116 ms (−5%) |               816 → 706 ms |    876 → 760 ms |          1452 → 1252 |
| `/:slug/` → `/:slug/summon`                    | 40 ms / 20 Mbps  |        1994 ms |  1815 ms |      −179 ms (−9%) |              1064 → 910 ms |   1128 → 972 ms |          1439 → 1239 |
| `/:slug/summon` (direct)                       | 40 ms / 20 Mbps  |        1987 ms |  1853 ms |      −134 ms (−7%) |              1076 → 934 ms |   1132 → 992 ms |          1438 → 1238 |
| Project work items                             | 40 ms / 20 Mbps  |        3477 ms |  3056 ms |    −421 ms (noisy) |             1288 → 1200 ms |  1344 → 1260 ms |          2295 → 2095 |

The work-items rows vary by ±0.4 s between runs (raw: base 2954–3791 ms, PR 2958–3533 ms at 20 Mbps), so treat those deltas as directional. The home and Summon rows vary by under 40 ms within each variant. On loopback (no RTT) the preload changes nothing, as expected for a latency-bound waterfall.

The empty-state change on its own (separate A/B, n = 5) moved the first API call 60–190 ms earlier on 4G and removed 201 KB on every row. Its ready time could not be resolved by that run's 500 ms-resolution metric.

Functional check on both builds: the same routes, the same final URLs, identical settled screenshots of the cycles and modules empty states and the Summon home, and no hydration warnings. Both builds log the same pre-existing 404s for `GET …/projects/:id/intake-state/` on projects without intake.

## Root causes

### 1. React Router's SPA mode preloads only the root route

`react-router.config.ts` sets `ssr: false`, so the build prerenders one `index.html` for `/`. `<Scripts />` emits `<link rel="modulepreload">` only for routes matched at prerender time, which is the root. Every deep link (`/<slug>/`, `/<slug>/projects/<id>/issues/`) gets that same HTML. On hydration, React Router 7.18 `loadRouteModule` does `import(route.module)` for each matched route and never preloads that route's `imports`, even though the manifest lists the full static import closure. The browser parses each module before it learns about the next level, so the initiator trace for a cold `/local-summon/` load shows a chain of roughly ten levels:

`entry → route layouts → layout-JFKqwnSr.js (36 imports) → emoji-icon-picker (36) → footer (18) → … → create-project-modal → item-icon → features-animation → modules → gantt-layout-loader → dropdown → state-dropdown-parts`

Each level costs one RTT. The first API call can only start after the last level, because `HydratedRouter` renders nothing until every matched route module has loaded.

**Invariant:** before hydrating, the client knows every module the current URL needs.
**Fix:** `app/route-module-preload.ts` matches `location.pathname` against `window.__reactRouterManifest` with React Router's own `matchRoutes`, and `entry.client.tsx` modulepreloads each matched route's module plus its imports before `hydrateRoot`. The `<link>` nodes are removed right after insertion, because React 18 hydrates the whole document and stray `<head>` nodes would be a hydration mismatch. The fetches continue into the module map.

### 2. `/:slug` redirects with a rendered `<Navigate>` (follow-up)

After sign-in or onboarding, `getWorkspaceRedirectionUrl` sends users to `/<slug>`. That route renders `<Navigate to="/<slug>/summon">`, so the redirect only happens after the workspace shell has loaded its modules and passed `WorkspaceAuthWrapper`'s API gate. Only then do the Summon home's own route modules start loading.

Moving the redirect into a `clientLoader` was measured and does not help: React Router still has to load the redirect target's modules before rendering, so the waterfall just moves ahead of the API chain. The fix that removes it is to point the workspace entry links at `/<slug>/summon` directly through one shared helper. React Router then loads the shell and the Summon home in one parallel batch, and the route-module preload from #1 covers direct loads.

### 3. The empty-state asset registry defeats tree-shaking

`asset-registry.tsx` mapped every asset key to a statically imported illustration component. Apps only use `EmptyStateDetailed`/`EmptyStateCompact` with an `assetKey`, but because the registry referenced all 48 illustrations, the bundler kept all of them.

**Invariant:** a screen downloads only the illustration it renders.
**Fix:** each registry entry is a `React.lazy` import of its own file, rendered inside `<Suspense fallback={null}>`. The `assets` barrel no longer re-exports the illustration components (no consumer imported them). The propel empty-state entry dropped from about 683 KB to 11.6 KB, and the 48 illustrations became separate chunks. Trade-off: an empty state's illustration now appears one chunk fetch after its text.

## Follow-ups (not in this PR)

1. **Send workspace entry links straight to `/:slug/summon` (#2).** Expected: about −0.3 s on 4G for every sign-in and workspace switch (measured gap between `/:slug/` and `/:slug/summon` with this PR).
2. **Bootstrap API chain (#4).** Fire `users/me`, `profile`, `settings`, and `workspaces` together with `instances` instead of after it, and start the workspace-level calls from the URL slug in parallel with the user calls. Expected: −300 to −600 ms on every full load, cold or warm. It needs a small prefetch owner that the services consume. `<link rel=preload as=fetch>` is not enough: axios' XHR did not reuse the preloads (tested).
3. **Asset caching on live (#5).** Serve `/assets/*` with `cache-control: public, max-age=31536000, immutable`, and warm the Cloudflare edge after each deploy (or move hashed assets to a cache-everything rule). Expected: returning users after 4 h skip ~290 revalidations, and first visitors after a deploy avoid the ~230 ms MISS penalty per chunk. Production config, so it is out of scope here.
4. **Shell weight.** The `[workspaceSlug]` layout pulls in 132 modules (507 KB br), including issue modals, gantt and timeline loaders, and quick actions. Load `GlobalModals` lazily on first open. `@plane/utils` is a single entry that drags `sanitize-html`, `parse5`, `unified`/`remark`, and `htmlparser2` (~75 KB br) into the shared chunk. Split it the way propel's entries are split.
5. **i18n loads all 28 namespaces at start** (`packages/i18n/src/core/instance.ts`, `ns: NAMESPACES`). It is one parallel wave, so not on the critical path, but it is 28 requests competing with route modules on a cold load.
6. **The >10 s blank first load seen in the nav-latency pass.** Its symptoms (router not initialized, 3 of 6 route modules loaded, then an auto-reload) match a stalled or failed route module `import()`, which React Router 7.18 answers with `window.location.reload()`. A chunk on a Cloudflare MISS, or a stale hash right after a deploy, would produce exactly that. Fix #1 starts those fetches earlier but does not remove the failure mode. Follow-up 3 would reduce it.
7. Dead code to delete: `packages/services/src/indexedDB.service.ts`, the commented IndexedDB block in `packages/shared-state/src/store/user.store.ts`, and `apps/web/public/{sw.js,workbox-*.js}`.

## Method notes

- Probe scripts (Playwright + CDP, scratch only, not committed) record navigation → first useful content, FCP, long tasks (`PerformanceObserver`), every request with bytes, cache source, and initiator, plus wrapped `indexedDB.open` calls.
- `<link rel=preload as=fetch crossorigin=use-credentials>` for the bootstrap API calls was tried first. The preloads hit the server, but axios' XHR requests went to the network again, so that approach was dropped.
- Importing `StoreWrapper`/`InstanceWrapper` statically instead of through `lazy()` was also tried. It made no difference (3869 vs 3866 ms) and was reverted.
- Early runs read "ready" through Playwright's `waitFor`, whose polling backs off to 500 ms. The final A/B timestamps readiness in the page instead (an rAF-throttled `MutationObserver`), and the A/B table above uses those values. The first API call and FCP come from CDP and `PerformanceObserver` timestamps in every run.
