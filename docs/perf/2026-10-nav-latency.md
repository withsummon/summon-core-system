# In-app navigation latency: core.withsummon.com (2026-10-15)

**Control artifact:** `main @ 5c7b704e7c6b53705757bb634213e7b880ea9d93`. `GET /ai/health` returned that version during measurement.
**Environment:** the user's Chrome on macOS (Claude in Chrome), signed in to workspace `summon-core` as a member of no Plane projects, desktop viewport, no throttling.
**Method:** an in-page probe clicks the sidebar link (or calls the router's `navigate`) and records click → URL change, the router going idle, resource timing for chunks and `/api/` calls, long tasks, and the last DOM mutation. The resource-timing buffer was raised to 5000 entries, because a full load already requests about 244 JS files and the default 250-entry buffer drops every API entry.

**Claim type:** live observations of the control build (n = 1–3 per transition). The fix's effect is an estimate from the measured mechanism. It has not been measured on a deployed variant, so treat it as directional.

## Summary

There are no long tasks on any measured transition (0 tasks ≥ 50 ms, except one 139 ms task on a cold Plane project route). React render CPU is not the bottleneck. Navigation feels slow for three reasons that stack up, ranked below.

| #   | Bottleneck                                                                               | Evidence (live, control)                                                                                                                                                                                                                                                     | Owner                                                                                                                                | Status                     |
| --- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| 1   | Route chunks load only after the click, and the URL waits for them                       | Plane project route, network-cold: **903 ms** click → URL, 39 chunks / 603 kB, last chunk at 743 ms. Cold Summon routes without hover: 144–326 ms.                                                                                                                           | `next/link` compat shim (`apps/web/app/compat/next/helper.ts`) and project tab links (`core/components/navigation/tab-navigation-*`) | **Fixed in this PR**       |
| 2   | Data is fetched only after the route renders, and the API slows down under parallel load | Each Summon page fires its query after the route commits: content at 150–250 ms. A Plane project route fires 12 parallel project calls on _every_ visit, including revisits: TTFB 250–450 ms, against a 73–89 ms serial floor for the same endpoints.                        | Per-page SWR/store fetches; API worker concurrency (Django behind Caddy)                                                             | Follow-up                  |
| 3   | Every Summon page fades and rises in over 455 ms                                         | `page-rise`: 420 ms ease plus up to 140 ms stagger. Opacity is 0.32 at 51 ms, 0.88 at 160 ms and 1.0 at 442 ms, even on warm navigations whose data is already cached (URL at 26–38 ms).                                                                                     | `apps/web/styles/globals.css` `.page-rise` and `SummonPageShell`                                                                     | Proposal (design call)     |
| 4   | A cold full load renders nothing until every route module and the boot data are ready    | `HydrateFallback` returns `null`. Twice, in a fresh tab, the first load stayed blank for more than 10 s with `router.state.initialized === false` and only 3 of 6 route modules loaded, then auto-reloaded through `recoverFromStaleAsset`. It did not reproduce afterwards. | Root route / `entry.client.tsx` stale-asset recovery                                                                                 | Follow-up (not reproduced) |

Correctness bug seen along the way: `document.title` stays at "Tasks · Summon Core" after navigating to Summon Projects and Resources.

## 1. Route chunks wait for the click

### Measurements (control)

| Transition                                                                       |              Click → URL | Chunks loaded on click      |    API done | Notes                                                                             |
| -------------------------------------------------------------------------------- | -----------------------: | --------------------------- | ----------: | --------------------------------------------------------------------------------- |
| Projects list → Plane project issues (network-cold)                              |               **903 ms** | 39 / 603 kB, last at 743 ms |     1265 ms | 12 project calls start only after the URL changes                                 |
| Same, HTTP cache warm, module map cold (after reload)                            |                   144 ms | from cache                  |           — | first run after the cache warmed                                                  |
| Same, HTTP and code cache warm                                                   |                 24–33 ms | —                           |           — | 6 alternating runs, with and without simulated preload: no difference once cached |
| → Plane project pages list (cold)                                                |                   292 ms | 6 / 14 kB                   |           — | project tab link, no prefetch                                                     |
| Summon Projects / Knowledge / Clients / Documents, cold, `click()` without hover | 198 / 326 / 144 / 276 ms | 7 / 14 / 3 / 1              | +100–200 ms |                                                                                   |
| Summon Resources, **after a real mouse hover** (sidebar has `prefetch="intent"`) |                **27 ms** | 0 (preloaded on hover)      |      150 ms | the hover emitted the route's `modulepreload` links                               |
| Any Summon route, warm                                                           |                 26–38 ms | 0                           |  100–230 ms |                                                                                   |

The cold project route's chunk set, fetched directly with `cache: "reload"`, took 331 ms for 2 MB (47 files) on the first fetch, then 71 ms once at the Cloudflare edge. Chunk hashes change with every deploy, so every user pays the cold cost on their first visit after each release.

### Root cause

React Router's `<Link>` defaults to `prefetch="none"`. In framework mode it fetches a route's modules on the click, and the navigation commits (and the URL changes) only once they have arrived. Plane's code was written for Next.js, where `<Link>` prefetches by default. The `next/link` compat shim forwarded an unset `prefetch` as `undefined`, which silently changed every link in the app to "load after click". Commit a12a2e14 had already put `prefetch="intent"` on the Summon sidebar links, which is why hovered sidebar navigation measures 27 ms. Every other link was still cold: project cards, the pinned project tree (Home / Tasks / Timeline / Views), and the Plane project tab bar, which uses React Router's `Link` directly.

**Owner:** the `next/link` compat shim, which is the single translation point between Next-style call sites and React Router.
**Invariant:** a link starts warming its route on intent (hover, focus or touch) unless it opts out with `prefetch={false}`. The other way to opt out, `prefetch="none"`, also still works.

### Fix (this PR)

- `normalizeLinkPrefetch(undefined)` now returns `"intent"`, so every `next/link` call site (92 files) prefetches on intent. `prefetch={false}` still maps to `"none"`.
- The explicit `prefetch="intent"` props in the sidebar item and mobile tab bar are deleted, because they now restate the default.
- The project tab bar links (`tab-navigation-root`, `-visible-item`, `-overflow-menu`) bypass the shim, so they get `prefetch="intent"` directly.
- Not covered: rows that navigate through `ControlLink` and `router.push` (sidebar Plane project rows, issue rows). `ControlLink` lives in `@plane/ui` and renders a plain `<a>`. Moving those rows onto the router `Link` is a separate change.

**Why "intent" and not "render" or "viewport":** a12a2e14 measured `prefetch="render"` on about 30 sidebar links at about 100 ms of main-thread time per navigation. "Intent" renders a single `PrefetchPageLinks` for the link under the pointer, so the cost stays bounded. Route data is not prefetched: the app has no `clientLoader`s, and data stays with the page's own SWR/store owners.

### Expected impact (directional)

React Router 7.18 starts an intent prefetch 100 ms after `mouseenter`/`focus`/`touchstart` (`usePrefetchBehavior`). Click → URL therefore shrinks by about (hover dwell − 100 ms), capped at the chunk wait:

- Network-cold project route (~740 ms of chunks): a 300 ms hover saves about 200 ms (~900 → ~700 ms). A deliberate hover of ≥ 850 ms reaches the warm figure (~30 ms). The cold-after-deploy case gets better but stays slow. Fully fixing it needs bundle work on the project route (603 kB on demand), which is a follow-up.
- HTTP-cached but not yet evaluated, the usual state within a session (144 ms measured): any hover over ~250 ms gives ~30 ms.
- Summon routes (110–330 ms cold): the project tree, project cards and project tabs now match the sidebar's measured 27 ms after hover.
- Fully warm: no change (24–33 ms either way, measured).
- Touch: almost no gain, since the tap usually lands within 100 ms of `touchstart`.

## 2. Fetch-on-render and API queueing (follow-up)

- Summon pages start their query in the page component after the route commits, so the earliest useful content arrives at commit + one API round trip: 100–200 ms warm, 150–250 ms after hover.
- Plane project routes fire 12 project-scoped calls (`/`, `members/`, `project-members/me/`, `issue-labels/`, `states/`, `intake-state/`, `estimates/`, `cycles/`, `modules/` ×2, `views/`, `user-properties/`) **on every entry**, revisits included. In parallel their TTFB is 250–450 ms. Serially, the same kinds of endpoints answer in 73–89 ms (`users/me` 82–89, `access/me` 80–88, `instances` 73–76; `home/summary` 118–137). That gap points to request queueing at the API (worker or connection count), not slow handlers.
- Next owners: (a) start the page's primary query on intent alongside the route chunks, through the existing SWR keys and store fetchers, not a component-local cache; (b) dedupe the project-wrapper fetches on revisit (revalidate, don't block); (c) check gunicorn worker and thread counts against 12-way bursts. This last one is deploy config, outside this PR.

## 3. Entrance animation (proposal)

`.page-rise > * > *` animates `opacity: 0 → 1` and `translateY(8px)` over 420 ms, with stagger up to 140 ms, on every Summon navigation (the outlet is keyed by pathname). On warm navigations the URL changes at about 30 ms and the data is already cached, yet content is 32% opaque at 51 ms and fully visible only at about 440 ms. For high-frequency sidebar navigation, consider one of these: limit the stagger to the first entry into a page family; start from opacity ≥ 0.6; or cut the duration to about 180 ms. This is a design decision (introduced in d68fec8c), so this PR doesn't change it.

## 4. Cold-load blank screen (follow-up, not reproduced)

In the first two loads of a fresh tab, the router stayed uninitialized (3 of 6 route modules loaded, no `/api/` calls, blank page) for more than 10 s. Then `recoverFromStaleAsset` reloaded the page (`__plane_chunk_reload` was set) and the second load rendered normally. Later loads rendered at once: HTML TTFB 40–60 ms over 12 samples, JS done at about 430 ms. A route module import appears to have hung, then failed. Next step: record `Failed to fetch dynamically imported module` events with the failing URL (RUM or Sentry) before changing the recovery path. `HydrateFallback` returning `null` means the user sees a blank page for this whole window, so a static shell there would at least show progress.

## Rejected variants

- **Viewport or render prefetch for every link:** costs main-thread time on each navigation (a12a2e14 measured ~100 ms for 30 render-mode links) and fetches routes the user never visits.
- **Idle preload of the Plane project route bundle:** 603 kB on every session, including users without Plane projects (like the measured account). Revisit if RUM shows most sessions open a project.
- **Memoizing or splitting sidebar observers:** no long tasks or wide commits appeared on Summon transitions, so nothing points there.

## Verification

- `node --test apps/web/app/compat/next/helper.test.ts`: passes, and covers the new `undefined → "intent"` mapping.
- `bun run check:types` (apps/web): passes once the workspace packages are built.
- `oxlint` / `oxfmt --check` on the touched files: clean (2 pre-existing warnings).
- Live proof of the mechanism: on the control build, hovering a sidebar link that already had `prefetch="intent"` emitted that route's `modulepreload` links, and the click committed in 27 ms.
- Not verified: a local dev server for this branch starts, but every app route redirects to a Google-only sign-in, so I could not exercise hover prefetch on authenticated routes there. The before/after numbers above are estimates until this branch is deployed and re-measured with the same probe.
