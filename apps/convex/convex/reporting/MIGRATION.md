# Bounded overview and report reads

## Legacy boundary

`apps/api/plane/summon/services/overview.py` owns home/project overview; `reports.py` owns portfolio reports, project/client/date scopes, due buckets, completion trends, commercial stage totals and CSV. Frontend consumers are `core/components/summon/home/home-root.tsx`, `projects/projects-directory-root.tsx`, `core/services/summon.service.ts`, and `app/(all)/[workspaceSlug]/(projects)/summon/reports/page.tsx`/`report-view.tsx`. Those Django consumers remain until the native frontend explicitly switches.

## Native contract

Each report query accepts `{scope, paginationOpts}`. Scope contains workspaceId, nullable projectId/clientId/dateFrom/dateTo, and an explicit ISO `today` to anchor due buckets consistently across page requests. Date filters are inclusive UTC days. Task/project/client/opportunity/document dates use creation time; meetings use startsAt, matching the legacy field choices. Completion trend groups completion dates for tasks selected by creation date. Today is a reporting parameter, not a security claim; UI should supply the intended reporting day.

`tasks.page`, `projects.page`, `commercial.clients`, `commercial.opportunities`, `meetings.page`, and `documents.page` return `{contribution, coverage:"page", continueCursor, isDone}`. A contribution is never a portfolio total. Consumers must consume every page and combine contributions, resetting when filters change. Individual query reads are consistent; a multi-page/multi-domain report is not a globally atomic historical snapshot, and concurrent changes can affect a traversal. Reactive consumers must recompute contributions instead of appending repeated updates. Empty pages can have a continuation cursor after permission/date filtering.

Each invocation scans at most 100 candidate rows / 1 MiB from an indexed workspace/project scope; request budgets cannot expand these limits. Referenced project checks are cached only for this page. No query collects all workspace projects/tasks/pages or performs an all-project query fanout. Document checks use existing document access ownership, including private-page ownership; project membership is required even for workspace admins. Explicit unauthorized project/client scopes fail rather than reveal rows. Clients and opportunities retain existing workspace-readable commercial semantics; project scope narrows them through the delivery profile's client.

Task contributions include completed/overdue/due-in-seven-days/later/no-date and completion trend. Cancelled tasks remain in the task count but are excluded from active due buckets. Commercial sums use BigInt cents and decimal strings, preserving Decimal(18,2) accuracy beyond Number's safe integer range. This is sales pipeline reporting, not an accounting module.

`overview.project` returns the authorized project, delivery profile, and latest 20 task summaries, with explicit coverage/omission metadata. It does not infer total progress from those 20 rows.

## Remaining scope

No automatic atomic report snapshots, accounting/ledger/invoice/expense reports, automation job usage, milestone/cycle reports, file counts, recent activity feed, or full legacy overview assembly. The native frontend can export completed supported contributions to CSV; legacy client-status/file/automation/activity rows are explicitly omitted. Existing resources/meetings/document APIs can supply their own paginated panels; no missing domain is represented as a misleading zero. Archived/deleted scope exclusions follow native owners. There is no justification to retire legacy reporting consumers yet.

## Verification

Module behavior tests cover pagination contribution aggregation, hidden projects despite workspace admin role, anonymous/workspace access, inclusive dates/invalid dates/page budgets, precise large commercial sums, projectless meeting exclusion under project scope, and private documents. Native TypeScript and Oxlint run with the whole backend suite. Runtime/frontend acceptance remains a separate gate.

Local runtime smoke 2026-09-26T23:17:12Z: authenticated benchmark project traversed 6 bounded report pages, summed exactly 500 tasks, and returned 20 recent tasks from the overview. Evidence `/tmp/summon-migration-control/reporting-smoke.json`. Expired saved JWT was rejected; fresh Password sign-in was required. This does not establish browser UI or global snapshot consistency.
