# Current module progress and distributions

## Registered owner and semantics

`apps/api/plane/app/urls/module.py` registers GET
`workspaces/<slug>/projects/<project_id>/modules/<pk>/` to
`ModuleViewSet.retrieve` in `apps/api/plane/app/views/module/base.py`.
The retrieve decorator permits administrators and members, not guests. Its
response combines module metadata, five state-group counts and numeric estimates,
assignee/label issue distributions (`total_issues`, `completed_issues`,
`pending_issues`), corresponding estimate distributions, and dated completion
charts. The web module service consumes module detail; there is no separate
registered module progress route to claim retired.

The native `modules.progress.page` requires canonical writer-role project access
through `requireModule`. Archived modules remain readable; deleted modules and
revoked membership reject. The indexed `moduleTasks.by_module_task` scan reads
1–20 memberships per request, with server-owned row/byte budgets. Each page passes
its tasks through the shared current-project/workspace and `taskCanRead` owner;
inactive, intake, deleted, and foreign records do not contribute. Many-to-many
links remain unchanged, so a task contributes independently in each module.
Sparse pages retain cursors and a zero contribution.

`tasks/progress_totals.ts` now owns current task filtering, bounded page options,
numeric parsing, and status/assignee/label aggregation for modules and cycles.
Completed means `completedAt !== null`; pending means null. This matches the
legacy completed-at filters, including cancelled tasks remaining pending.
`tasks/schema.ts` requires `completedAt: number | null`; `tasks/create.ts`,
`tasks/status.ts`, and `tasks/property_updates.ts` initialize/update it atomically
to a timestamp for Done and null otherwise. This read has no missing-field fallback.
Every bucket and the overall contribution includes completed and pending counts,
numeric estimate sums, and unquantified estimate counts. Shared-assignee/label
totals overlap by design. Signed/scientific finite decimals use the existing
canonical parser; unrelated estimate/label metadata remains redacted.

The historical cycle transfer writer projects the original persisted snapshot
shape explicitly. Existing snapshots acquire no invented completion fields and
are not reinterpreted as current progress. No schema migration is required.

## Delivery boundary

Source implementation passes native backend TypeScript7, scoped Oxc, and 21
module/cycle/transfer behavior tests. The four module tests cover many-to-many
links, sparse continuation, completion distributions, guest/revoked access,
archived read, and foreign/deleted task records. The UI reuses `tasks/progress/{summary,distribution,panel}` for both cycles and
modules, preserving explicit loaded-page coverage. The former cycle-only summary,
distribution and test files were removed; behavior tests now live beside the
shared owner. Generated current rows carry required completion breakdowns;
persisted historical rows retain their separate generated shape. Singular task
counts render correctly. Native web TypeScript7, scoped Oxc and both shared
aggregation behavior tests pass. Live pages can
update independently and do not form a globally atomic report.

Dated burndown/completion charts, legacy avatar/color decoration, exact REST field
aliases, and inherited route cutover remain separate contracts. The existing
Django module route is not retired. No deployment or browser acceptance is
claimed by this receipt until recorded below.

## Local activation

Atomic source/UI commit `a382f3edef` was deployed from an immutable archive to
`http://127.0.0.1:3210` after the archive passed native TypeScript7. Deployment
log: `/tmp/summon-migration-control/module-progress-a382f3edef-local-deploy.txt`.
The primary agent was notified that the coordinated cutover was complete before
resuming module/cycle Chrome acceptance. No remote push was made. Browser proof
for this new module slice remains pending; cycle proof recorded in `9019e17173`
precedes the completion-breakdown extension. Scoped manual gates were used with
commit hooks disabled under the active migration workflow.

## Primary Chrome read acceptance

On local3010, Release readiness module `rh73gsdw9dpnkn1ew1jy12460d8f7xxc`
showed1 visible task, Done1 and numeric estimate0. Northstar QA Owner showed1
completed task and0 pending; No label showed the same breakdown. The primary
agent inspected desktop and390px screenshots: no horizontal overflow at390px,
and names and breakdowns wrapped. The viewport override was cleared.

This was read acceptance only: no module status mutation, guest session or
more-than20-membership browser traversal was exercised. Those boundaries retain
BDD evidence, not browser claims. Heading fixes `a3b6a44153` / `e7230b6711` use
h4 below Current progress h3 and retain h5 below the historical Transfer h4;
scoped Oxc/format checks pass.
