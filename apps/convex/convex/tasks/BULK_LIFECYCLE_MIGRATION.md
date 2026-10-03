# Atomic bulk task lifecycle

Legacy `app/views/issue/base.py:BulkDeleteIssuesEndpoint` requires administrator role and project/workspace scope; it deletes cycle/module links before soft-deleting tasks. `archive.py:BulkArchiveIssuesEndpoint` allows admin/member, validates completed/cancelled state, and archives selected issues. Native deliberately retains memberships/graph on deletion for its existing recoverable lifecycle contract; this is an explicit difference, not exact deletion parity.

`tasks.lifecycle.change` and `bulk` share prepareChange/applyChange. Bulk accepts one project, operation, and 1–20 distinct task IDs with captured revisions. It validates current access, exact project, state, and all revisions before any patch/event. Convex transaction rollback covers later event failures. Bulk deletion adds administrator-only gate; archive/unarchive require writer; restore retains per-task creator/admin recovery authorization (guest bulk denied). Single-task guest-creator recovery is unchanged. Repeated state is a no-op only after authorization/revision checks. No purge or cascade is added.

Static fanout accounting, not measured runtime capacity: batch20 bounds the existing100-subscriber event owner to at most2000 recipient insertions,20 events and task lifecycle/revision patches. No change to notification recipient ACL, event visibility or subscription limits. This is a bounded explicit selection, not a whole-project action or silent multi-transaction loop. `bulkAccess` exposes canonical canChange/canDelete/maxTasks for UI.

Three new BDD plus six existing lifecycle tests pass: invalid-state and stale mixed batches do not write task/event changes; archive/unarchive success; duplicate/empty/oversized rejection; creator cannot bypass admin-only bulk deletion; private recovery remains usable. Backend and web TS7/scoped Oxc pass. UI component is prepared but unmounted until deployment. Browser acceptance and REST aliases remain parent-owned follow-up; bulk dates/properties/labels are separate parity work.

Root activation/acceptance: d6523a8090 backend deployed to both hosts in
af588be807. Chrome local3010 selected synthetic NSTAR6 and NSTAR7, inspected the
captured-name confirmation, and moved both to Trash. Both disappeared from active
rows and appeared in Trash. Selecting both there and confirming Restore emptied
Trash. Reopening NSTAR7 showed its parent NSTAR6, cross-project QADEL1 relation,
estimate and retained attachment. No permanent deletion occurred. Root independently
ran all nine bulk/lifecycle tests. UI now mounts active/archive/Trash lists.
