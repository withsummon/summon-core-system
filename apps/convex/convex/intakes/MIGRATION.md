# Intake admission slice

## Owner and invariant

`tasks/create.ts` is the sole production task insertion/sequence owner for ordinary tasks and intake submission. Submission allocates a task in the reserved `triage` group plus an intake bridge in one mutation. Acceptance updates that same task to the existing project default state. Missing default state or stale task/bridge revision aborts the entire mutation. Task identifiers, sequences and existing references remain unchanged. Later changing intake decision from accepted to rejected does not move an already admitted task back to triage: the legacy ordinary IssueManager filters state group, not intake status.

`tasks/access.ts` owns exclusion of triage from ordinary active/read/recovery APIs, reports, workspace task center, notifications and assistant task authorization. Ordinary property/state/status writers cannot select or mutate the reserved group. Cycle/module/meeting/hierarchy assignment reads use this owner. Existing retained relationship cleanup still hides inaccessible endpoint content. No new rich-content writer was invented: intake uses the canonical task HTML sanitizer and taskDescriptions table.

## Public native boundary

`intakes.index.getConfig/configure` owns project intake enablement and guest visibility; default intake creation occurs atomically on enable. New projects initialize both flags false. Existing absent flags mean the legacy false defaults; this is a stored-row migration contract, removable after a bounded project backfill and deployed schema verification. Flags share the existing project metadata revision.

`submit` accepts title, sanitized HTML and priority, including from current project guests. `list` is status-filtered, cursor-based, capped at 100 rows/1 MiB reads; filtered pages can be empty with continuation. `get/resolve` returns canonical task, intake, HTML, currently accessible duplicate summary and server capabilities. `edit` uses task+bridge CAS; guest creator edits only title/description. `decide` is administrator-only, keeps source identity, validates snooze timestamps and same-project ordinary duplicate targets. Snooze records a deadline; it does not schedule automatic status transitions. `remove` soft-deletes the bridge and, for nonaccepted decisions, soft-deletes the task. Accepted task content remains available through ordinary task APIs.

All entrypoints require current active workspace and project membership. Project administrators and workspace administrators who belong to the project may configure/triage. Guests see their own submissions unless the project guest-feature flag permits all; creator/admin edit and removal capabilities are projected. Disabling intake prevents new submissions but retains authorized access to existing submissions.

## Deliberate first-slice limits: legacy remains registered

- This is default-intake admission, not complete Intake configuration CRUD. Additional intake configuration fields/view properties/logo properties, extra/source email/external identifiers, custom intake creation/removal, full filtering/sorting and counts remain staged. Native source is IN_APP. An existing ordinary state named Triage must be renamed before first submission; the reserved state is never silently repurposed.
- Description HTML is supported through the current native sanitizer. Legacy rich JSON/binary and ten-minute coalesced description-version history remain staged. Broader issue property editing, intake comments, reactions/mentions and issue attachments are not exposed through this slice. Ordinary comment/description endpoints reject triage instead of leaking it.
- Current native permission model requires active project membership even for creators; legacy creator decorators can differ. Native guest-feature projection currently changes intake visibility only; inherited guest behavior in other features remains separately staged.
- Removal is soft deletion, not user-recoverable removal: there is no intake restore API/UI in this slice. Native relationship preservation differs from legacy related soft cascade. Trashed triage tasks are excluded from ordinary task recovery, so an explicit intake recovery owner is required before offering restore.
- Public project-board/anchor access, public creator-only bridge deletion, PAT authorization/deletion differences and REST aliases are not migrated. The app, public and PAT controllers have different behavior and must not be collapsed into a single claimed-compatible adapter.

## Legacy evidence

`db/models/intake.py` owns configuration and bridge fields/statuses. `app/views/project/base.py` and `api/views/project.py` create the default intake on enable. `app/views/intake/base.py` owns app submission/edit/status/delete and description-history reads; `app/serializers/intake.py` owns acceptance/default-state semantics. `db/models/issue.py` owns sequence allocation and TRIAGE exclusion. `app/permissions/base.py` owns creator/admin exceptions. `bgtasks/issue_description_version_task.py` owns description history coalescing. `app/views/asset/v2.py` owns issue-bound project assets. `space/views/intake.py` and `api/views/intake.py` are separate public/PAT behavior owners. Their routes stay registered.

## Verification

Module-local `__tests__/journey.test.ts`: seven behavioral journeys cover stable identity and sequence, missing-default rollback, repeated stale decisions, accepted-to-rejected state preservation, guest creator edits/visibility/flag/revocation, reserved-state bypass rejection, enablement/settings CAS, removal outcomes, ordinary task/report/content boundary isolation, duplicate target scope/current deletion, snooze validation page budgets, and the existing project metadata migration barrier. Full backend tests and native TypeScript/Oxlint gates run separately from browser/deployment acceptance. No deployment or browser acceptance is claimed by this receipt.
