# Convex migration acceptance record

Control artifact: 05f894b84bbde4e2474b82f17be7f4578bc15f14

Work lane: Implementation. The requested architecture migration is authorized; performance claims require a faithful passing control and comparable repeated candidate measurements. Existing editor/UI dependency additions are outside this task and preserved.

## Decision and invariants

Replace Django application ownership with selfhosted Convex, preserving current user journeys. The first slice is sign-in -> authorized workspace/project -> task creation/status change -> second-client update. Active membership, role permissions, tenant isolation, idempotency, and durable writes are mandatory. Protected content must never render before access is established. Sign-out and account switching must discard the former identity's subscriptions.

Initial synthetic targets (acceptance budgets, not measured results): local feedback within 50 ms, warm navigation useful content p95 under 300 ms, committed task update reaching a second local client p95 under 500 ms. Network topology and server placement must be recorded before applying these targets to remote hosting. Record cold auth separately. No production capacity claim without mixed workload and recovery evidence.

## Ordered slices

1. Toolchain: TypeScript 7 native compiler, Oxlint/Oxfmt coverage and enforcement.
2. Convex infrastructure, identity, tenancy, projects, tasks and realtime public-boundary tests.
3. CRM and atomic opportunity-to-delivery handoff.
4. Documents/assets/editor, meetings and explicit task linking.
5. Assistant, automation, MCP, credentials, reports/settings/notifications; inherited route closure and Django retirement.

Each slice requires module-local behavior tests, owner review, authenticated Chrome QA where it changes UI, and an atomic commit. Record completed and pending gates separately. Removing old services is gated on proving no active consumers remain; do not destroy database volumes as part of service retirement.

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
- [Retirement gates](retirement-gates.md) record active legacy consumers and the conditions for stopping Django/Postgres. The full migration and remote application deployment are not complete.
