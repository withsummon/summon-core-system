# Project cycles and canonical project timezone

## Traced legacy owners

`plane/db/models/cycle.py` owns Cycle/CycleIssue; `app/views/cycle/base.py`, `issue.py` and `archive.py` own CRUD, assignment/move, date check, archive and transfer; `app/serializers/cycle.py` and `utils/timezone_converter.py` own legacy date conversion. Web owners are `cycle.service.ts`, `cycle.store.ts`, and `components/cycles/{modal,form,transfer-issues-modal,delete-modal}.tsx`.

Legacy `Project.timezone` (`db/models/project.py:117`) is independent after initialization from Workspace.timezone (`:173`). Native `projects.timezone` now closes that owner gap. New projects copy the canonical workspace setting, whose existing unset default is UTC. Workspace changes do not rewrite existing project timezones. Project admins can change it through `projects.timezone.save` with expected-value comparison; the project schema has no updatedAt field to advance. Workspace admin without project membership cannot bypass access.

## Required existing-project migration

Stored project timezone is temporarily optional for existing native rows. `projects.timezone.backfill` is an internal mutation, 50 projects/1 MiB per cursor page, setting only missing values from each project's current workspace setting. Run every continuation until isDone; repeat a complete scan to verify zero changed rows. It never overwrites a customized timezone. Unbackfilled project timezone reads and cycle creation fail explicitly instead of silently choosing a timezone. After all deployments/data are migrated, make the schema field required and remove this temporary mutation. No backfill or deployment was performed by this implementation task.

`settings/timezone.ts` owns validation/default and is reused by workspace settings, project creation, project settings and backfill. There is no test-only mutation/API.

## Cycle contract

- Active project membership owns reads; workspace/project members or admins write. Creator or project admin can soft-delete/restore while retaining current write access. Guests read, but cannot change cycles even when they originally created one.
- Each cycle snapshots its project's timezone. Dates are strict YYYY-MM-DD civil dates: both null makes a draft; otherwise start <= end. Phase is upcoming/current/completed in the saved timezone, with the end date inclusive for the whole local day. This avoids manual fixed-offset arithmetic and handles DST. It intentionally does not reproduce the legacy start-today timestamp/23:59 end conversion quirks.
- Overlap is a **project civil-date interval invariant**, checked inside create/update/restore transactions. Adjacent civil dates remain allowed after a project timezone change, even when the two saved timezones imply overlapping UTC instants. This is not a claim of disjoint UTC time intervals. Existing cycles retain their saved timezone; no implicit rescheduling occurs.
- Detail get/resolve queries require explicit `now` and validate representable Date/safe-integer input. Paginated list returns raw cycle rows without a clock argument or phase projection. The frontend reuses the canonical pure cyclePhase owner with a local minute/focus clock, so time updates do not reset pagination. Time passing alone does not invalidate a Convex subscription. Mutation restrictions always use server time, not the supplied display clock.
- Metadata writes use monotonic updatedAt CAS. Completed/archived/deleted cycles cannot be edited or receive membership changes. Archive requires completed; unarchive does not reopen completed dates. Sorting-only edits of completed cycles are not implemented.

## Membership and reversible lifecycle

`cycleTasks` has one indexed lookup per task. Assign atomically inserts or moves its one row; a repeated assignment to the same target is a no-op. Move/remove checks current task revision and target cycle revision, same project and open source/target lifecycle. Canonical `tasks/revision.ts:taskChanged` advances task revision and emits the existing generic updated event through recipient notification delivery; this slice does not invent a separate competing task activity owner.

Cycle soft deletion retains task records and membership rows. Current membership reads hide deleted cycles. A task can move from a deleted cycle into another open cycle; restoring the old cycle does not steal moved tasks back. Restore checks date conflicts before reactivating it. Cycle lifecycle changes do not rewrite each member task or fan out task events; complete legacy cycle-deletion/transfer activity projections remain outside this slice.

Bounds are explicit: at most **200 nondeleted cycles per project** and **100 task memberships per cycle**. Archived cycles count toward the first limit. Capacity rejects the next write; accepted membership is never silently truncated. Cycle/task list requests use at most 100 candidate rows/1 MiB. These are bounded first-slice product limits, not measured capacity claims.

## Public API

`cycles.index`: create, update, get, resolve(raw ID), list(deleted flag, pagination), lifecycle(archive/unarchive/delete/restore). Get/resolve project canWrite/canEdit/canDelete from current ACL and lifecycle. `cycles.tasks`: assign/remove with task+cycle revision, current(taskId), bounded list(cycleId). `projects.timezone`: get/save; internal backfill is operator-only.

## Verification and exclusions

Eleven module-local BDD cases cover workspace initialization/project independence/backfill, invalid zones and stale timezone saves, date validity/local-day/DST boundaries, transactional overlap, same-clock CAS, assignment/move/no-op, deleted cycle restore and moved task preservation, cross-project/guest/revoked denial, completed-source restrictions, creator/admin lifecycle, concurrent repeated deletion, invalid read clocks/page budgets, 51-row backfill pagination, both capacity limits and canonical task revision/event behavior. Focused native typecheck and Oxc lint/complexity pass. No deployment, backfill, browser acceptance or production benchmark is claimed.

Unfinished-task transfer with completion/progress snapshots, burndown/distributions/analytics, favorites/recent-visits, sorting, personal filters/view properties, logo/external import projections, workspace active-cycle dashboards, cycle-specific before/after notification payloads and public/PAT endpoint compatibility remain. Modules are a separate many-to-many domain with lead/member roster and status lifecycle; no module parity is claimed. Legacy routes remain registered.

## Primary integration acceptance

Local backend deployed at 08:09:05 on 2026-09-27. The operator ran every timezone-backfill page (one page, 11 existing projects changed), then a second complete pass (one page, zero changed). This is local deployment/backfill evidence only.

Primary independently ran all 250 backend tests across 29 files and the native backend type check. Chrome acceptance through the native project route covered a scheduled Asia/Jakarta cycle, current phase, task assignment, a second guest client receiving the live membership with no write controls, a stale owner draft rejected without losing its text, Trash discovery/restore retaining membership, move to a second draft cycle removing the old membership, and explicit task removal. A 390px viewport kept all inspected controls readable with document scrollWidth exactly 390; the override was reset.

The first browser date-fill attempt changed DOM values without firing controlled-input change events; it created a draft and is not schedule acceptance evidence. Native accessibility date entry then updated the min/max/required constraints and saved the correct 2026-09-27 through 2026-10-03 dates. No source workaround was added for the automation artifact. Archive/date-conflict/timezone-change edge cases remain backend-test evidence rather than full browser-matrix coverage.
