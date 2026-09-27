# Convex migration acceptance record

Control artifact: 05f894b84bbde4e2474b82f17be7f4578bc15f14

Work lane: Implementation. The requested architecture migration is authorized; performance claims require a faithful passing control and comparable repeated candidate measurements. Existing editor/UI dependency additions are outside this task and preserved.

## Current PR verification policy (2026-09-28)

The PR quality pass removed all 150 test files added by this migration. Earlier test counts below are historical results from earlier commits; those suites are no longer runnable from this branch. `pnpm test` now runs only the inherited live service suite. Backend and web acceptance require current native type/lint/build checks and focused Chrome journeys, including authorization and cross-client behavior. New automated coverage should target critical interactions without rebuilding a per-feature assertion suite. Django and PostgreSQL retirement remains gated on every inherited Plane route, external contract, and operational owner.

## Decision and invariants

Replace Django application ownership with selfhosted Convex, preserving current user journeys. The first slice is sign-in -> authorized workspace/project -> task creation/status change -> second-client update. Active membership, role permissions, tenant isolation, idempotency, and durable writes are mandatory. Protected content must never render before access is established. Sign-out and account switching must discard the former identity's subscriptions.

Initial synthetic targets (acceptance budgets, not measured results): local feedback within 50 ms, warm navigation useful content p95 under 300 ms, committed task update reaching a second local client p95 under 500 ms. Network topology and server placement must be recorded before applying these targets to remote hosting. Record cold auth separately. No production capacity claim without mixed workload and recovery evidence.

## Ordered slices

1. Toolchain: TypeScript 7 native compiler, Oxlint/Oxfmt coverage and enforcement.
2. Convex infrastructure, identity, tenancy, projects, tasks and realtime public-boundary tests.
3. CRM and atomic opportunity-to-delivery handoff.
4. Documents/assets/editor, meetings and explicit task linking.
5. Assistant, automation, MCP, credentials, reports/settings/notifications; inherited route closure and Django retirement.

Each slice requires owner review, focused integration verification, authenticated Chrome QA where it changes UI, and an atomic commit. Record completed and pending gates separately. Removing old services is gated on proving no active consumers remain; do not destroy database volumes as part of service retirement.

## Existing owners to replace

- Identity: Django sessions, Plane user/profile/settings APIs, `AuthenticationWrapper`, workspace/project stores.
- Authorization: `apps/api/plane/summon/permissions.py` and project checks in collaboration views.
- API: `apps/web/core/services/summon.service.ts`, `summon-plane.service.ts`, inherited issue/page/asset services.
- Editor: Hocuspocus auth and persistence call Django user/page/asset APIs.
- Jobs: transcription, summary generation, artifact publication and assistant side effects.

Meeting summary generation must continue to create/update its canonical document without silently creating tasks. Explicit task linking is a separate operation. Long-running actions must reauthorize in their final committing mutation.

## Measurement ownership

Record intent, feedback, session/access, route/import, data, render/paint and input readiness separately. Compare equivalent fixtures, identities, build mode, host topology, cache state and query scope. The current task/document aggregator discovers projects through a home summary and scans all project pages; deleting that fanout is a query-shape improvement and must not be credited solely to the Convex runtime.

Candidates: existing Django owner with bounded query; Convex reactive bounded query; reject component caches and duplicate permission policies. Retain rejected/invalid samples with reasons. Control source identity is recorded in `control.json`; successful first-slice and expanded-checkpoint measurements are recorded under `benchmarks/`, with non-equivalent contracts explicitly labeled directional.

## Current acceptance evidence

- [First-slice browser and backend QA](first-slice-qa.md), [task UI](task-frontend.md), [commercial](commercial-frontend.md), [settings](workspace-settings.md), [documents](documents-frontend.md), [meetings](meetings-frontend.md), and [assistant](assistant-frontend.md).
- [Expanded checkpoint benchmarks](benchmarks/ba52bcfca9/README.md) record the immutable production build, three API trials, Chrome timings and native task-route transport; [endpoint parity](endpoint-parity.md) names the remaining contracts. At that checkpoint, 206 backend tests, 30 typecheck, 21 lint, 21 format and 16 build tasks passed.
- [Local restore rehearsal](backup-restore.md) verifies exact records and stored files in an isolated instance.
- [Retirement gates](retirement-gates.md) record active legacy consumers and the conditions for stopping Django/Postgres. The full migration is not complete. Remote function and browser checkpoint evidence appears below; public frontend cutover and remote recovery remain pending.

## Follow-up checkpoint: `10da39c21e`

This checkpoint adds resource-to-credential association with redacted inaccessible metadata, private assistant text attachments, supplied meeting transcripts and canonical summary execution, and the shared editor replacement fix. Receipts: [resource credentials](resource-credentials.md), [assistant attachments](assistant-attachments.md), [meeting summary](../../../apps/convex/convex/meetings/summary/MIGRATION.md), and [compact workspace layout](frontend-slice.md). Actual provider generation remains unverified because no LLM provider is configured.

Verification: 236 backend behavior tests in 28 files passed; 21 formatting, 21 lint and 16 production build tasks passed. The full 30-task type gate passed before the final shared document converter fix; focused backend/editor/web native checks passed after it. These are local checks, not remote deployment evidence.

The immutable local web build at `http://127.0.0.1:3014/core` was built with `VITE_APP_VERSION=10da39c21e`. It contains 1,231 files; its served index SHA-256 is `c746e95023dcbe813eb8feb3f3036ceafca31c2689791e6d4346570c0aa7a632` (HTTP 200, exact match to the copied build). Chrome authenticated with the synthetic QA account and loaded the canonical transcript document with its correct title and replacement-only content; no error-level console entries were observed. This build preserves the preexisting editor/UI dependency additions. It is not the earlier `ba52bcfca9` benchmark artifact, and no new performance delta is claimed.

Legacy comment deletion is soft by default; native hard deletion was identified as an unresolved recovery gap. Cycles, full inherited Plane scope, public API consumers, identity parity and remote DNS/TLS remain retirement gates. Django/Postgres remain available.

## Follow-up checkpoint: `8496aa7bd6`

[Cycles](cycles-frontend.md), [modules](modules-frontend.md), [comment recovery](comments-frontend.md) and [project settings/archive recovery](project-settings-frontend.md) were committed with local Chrome acceptance. At this checkpoint, **264 backend tests / 31 files, 19 frontend tests, 30 native typecheck tasks, 21 lint tasks, 21 formatting tasks and 16 production build tasks passed**. The backend and frontend test files were later removed by the PR quality pass above; this paragraph is historical evidence only.

The [build manifest](checkpoints/8496aa7bd6.json) identifies the immutable production copy served on port 3015. HTTP `/core` returned 200 and its SHA-256 matched the recorded index. Authenticated Chrome opened [Release readiness](http://127.0.0.1:3015/core?workspace=northstar-convex-qa&project=NSTAR&projectView=modules&projectModule=rh73gsdw9dpnkn1ew1jy12460d8f7xxc), verified its retained description, lead, roster and task, and reported no error-level console entries. This is a local runtime checkpoint, not remote hosting acceptance or a new benchmark sample. Preexisting editor/UI dependency edits remain preserved.

Both project timezone and metadata migrations updated 11 local projects, with separate second scans finding zero remaining changes. Backend function deployment was verified locally at 08:33:01. The task lifecycle migration is the next coordinated slice; no task lifecycle completion is claimed here. Full inherited route parity, external API contracts, live providers and remote DNS/TLS still prevent Django/Postgres retirement.

## Follow-up checkpoint: `903cee2124`

Native task lifecycle, personal quick links, intake admission/recovery and shared task/intake description history are committed. Primary gates passed 301 backend tests in 36 files, 19 frontend tests, 30 native TypeScript tasks and 21 lint/format tasks. The production web build passed. Module receipts distinguish browser-verified paths from automated-only coverage.

Owned DNS and validated HTTPS now serve the pinned Convex backend/actions/dashboard. Committed functions `903cee21243acfacb92950ef7615b55513d80a84` deployed successfully. The [remote checkpoint manifest](checkpoints/903cee2124-remote.json) records the production web artifact, exact served index hash and topology: local frontend on port 3016 against remote Convex. Chrome verified sign-up, workspace/project/task creation and a second tab receiving the task without reload. This is not a public frontend rollout or a new performance benchmark.

Saved views and other inherited contracts, public frontend cutover, provider configuration and remote recovery remain open. Django/Postgres stay active.

## Follow-up checkpoint: `5ed8c4493a`

Project saved views now support typed filters, reactive results, personal favorites and recoverable removal. Local gates passed 307 backend tests and 21 frontend tests; native type checks and Oxc checks passed. The [frontend receipt](saved-views-frontend.md) separates exercised browser flows from remaining coverage and inherited contract gaps. The [remote artifact](checkpoints/5ed8c4493a-remote.json) records the exact served production frontend and peer-tab result inclusion/exclusion against the self-hosted backend.

A [remote-source authenticated restore](checkpoints/903cee2124-remote-restore.json) also passed into a separate local instance with restored code and auth environment. This does not establish Dokploy disaster recovery or remote binary recovery. Workspace/rich saved views, task attachments and other inherited contracts, public frontend cutover, provider configuration and operational recovery gates remain open. Django/Postgres stay active.

## Follow-up checkpoint: `2d22f081b8`

Project and workspace saved views, task attachments and their recovery flows are committed and deployed to the self-hosted backend. Workspace results share the canonical filters and independently authorize each project; existing project APIs remain compatible. Both deployment ownership backfills and zero-change verification scans completed, after which optional fields and migration code were removed. The [workspace receipt](workspace-saved-views-frontend.md), [attachment receipt](task-attachments-frontend.md) and [remote artifact](checkpoints/2d22f081b8-remote.json) separate local and remote browser evidence.

Final primary checks: 318 backend tests / 39 files, 25 frontend tests, 30 native TS7 tasks, 21 lint tasks, 21 formatting tasks, production web build. Root lint retains its inherited warning baseline. Independent reviews found no blocking findings in the sampled slices. Remote-source restore now proves 38 records across 59 tables and one stored file equal, plus fresh authenticated identity/workspace access; this is isolated local recovery, not Dokploy disaster recovery.

Full inherited rich filters/layouts, broader attachment MIME/activity/API contracts, remaining identity/integrations/admin/import/export contracts and legacy route ownership remain required. Public frontend cutover, live provider configuration and operational recovery are also open. Django/Postgres have not been retired. No new performance delta is claimed.
