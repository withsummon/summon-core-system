# Production UI preservation contract

The user explicitly chose **the currently deployed UI**, rather than the newer grouped-task design in this checkout, as the Convex migration baseline on 2026-09-27. Preserve its layouts, navigation, design system, interactions, feature discoverability, responsive behavior and workflows. Changing the backend does not authorize replacing that product experience.

## Verified baseline

Primary refreshed `https://core.withsummon.com/summon-core/summon/tasks/` in authenticated Chrome. The live Task Center has the workspace header and Summon sidebar, ownership tabs, date-filter counts, task table, pagination, summary/deadline/calendar panels and production create-task controls. Desktop rendering was inspected at 1728px; a 390×844 constrained viewport was also inspected and then reset. The narrow view exposed the existing sidebar overlay and horizontal table behavior; this observation does not certify mobile quality or authorize removing functionality.

The existing Dokploy product service `yDkrsj9EEzFMdEPsiRsPV` lists its latest completed deployment at `afe708b92370542e09dd065454337e3c83c08604`. This is deployment-control-plane source evidence alongside a live rendering observation. Exact running web image/served build identity remains to be established. An unauthenticated command-line fetch returned403; it was not treated as product downtime or bypassed.

## Cutover gates

1. Use the deployed presentation lineage. Audit later checkout changes per owner; preserve backend/toolchain fixes and unrelated work instead of resetting the repository.
2. Replace data ownership under the existing routes and components: authentication/instance/workspace bootstrap, then feature subscriptions and mutations. Do not populate legacy DTOs with fabricated defaults, cast native IDs into legacy UUIDs, or keep competing REST and Convex writers.
3. Preserve task full-page/peek detail, editor autosave and error behavior, intake split pane/mobile navigation, project settings/deletion confirmation and existing cycle analytics composition. Complete their actual consumed contracts before claiming parity.
4. Compare each migrated journey with the live baseline in Chrome at intended and constrained widths; test refresh, deep links, back/forward, loading, errors, permissions and live updates. Capture runtime network evidence that the migrated family no longer depends on Django.
5. Retire Django, workers, Postgres and old frontend paths only after functional, visual, runtime, deployment, backup and equivalent-benchmark gates pass. No current standalone QA checkpoint meets that whole-system gate.

## Status of current migration UI

`/core` and the separate native-stickies route are temporary migration/QA surfaces. Their tests and browser receipts establish the named backend workflows only; they are not approved replacement product UI. No new simplified screen may be used to justify production cutover. The native-stickies route defaults to legacy ownership and must not be enabled for production without preserved-UI acceptance.

Useful normalized Convex domain work is retained. The task-image/intake checkpoint passed scoped functional Chrome journeys, but its presentation is not production UI parity. Unmounted cycle-chart and project-Trash QA drafts are held outside the checkout. Project Trash, cycle completion curves and the final content-token cleanup remain undeployed at this contract checkpoint. Existing production Django/frontend paths remain active.
