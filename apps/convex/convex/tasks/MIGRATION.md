# Native task property slice

## Owner and contract

`schema.ts` owns task status, priority, custom project states, labels, and property validators. `properties.ts` validates same-project references and current assignment authority. `index.ts` owns atomic creation, edits, sequence allocation, completion timestamps, and events. Generated function types are the frontend contract; no REST aliases or hand-written task DTOs were introduced.

The existing `create({projectId,title,description?})`, `list`, and `setStatus` contracts remain valid. Creation accepts optional extended properties. Full `update` accepts title, plain description, coarse status, custom state, priority, dates, assignees, and labels. A custom state's group must agree with the task's coarse status. The group is materialized on the task for indexed subscriptions; a populated custom state must be emptied before its group changes or it is deleted.

Assignees must be active writers in the project and workspace. Invalid assignee/label references are rejected, whereas the legacy serializer silently removed some invalid references. State and label administration is project-admin only; legacy state PATCH allowed broader roles. These deliberate boundaries retain the new workspace/project write invariant.

`center.list` scans bounded workspace pages and applies current project access, scope, due, priority, project, and search filters at the server. It returns no global count. A filtered page may be empty while `isDone` is false; the caller must permit loading subsequent pages. This is correctness and bounded query work, not a claim of optimal indexed search performance.

## Existing first-slice records

The additive migration and its behavioral test are recorded in commit `8e5d49e123`. The primary agent deployed that version locally and ran the bounded internal backfill to completion. The receipt at `/tmp/summon-migration-control/task-properties-backfill.json` was read back before tightening the schema:

```json
{
  "deployment": "http://127.0.0.1:3210",
  "controlCommit": "8e5d49e123",
  "migrated": 1001,
  "pages": 11,
  "isDone": true
}
```

Task properties are now required by the schema. The temporary backfill function, optional properties, and transitional read defaults are removed. Existing IDs, sequences, statuses, and creation attribution were preserved. Old done tasks use their last first-slice `updatedAt` as completion time; this is available first-slice evidence, not reconstructed history. This receipt concerns the local instance only. Any other instance with old task records must first run the additive commit's backfill before adopting this required schema.

## Verification and review

The original task authorization, pagination-budget, concurrency, and retry tests remain in `__tests__/journey.test.ts`. `__tests__/properties.test.ts` adds native-boundary scenarios for property persistence, completion/reopen, invalid references/dates, assignment authority, custom-state defaults/lifecycle, role restrictions, workspace filtering, and empty-page continuation.

Owner review: task creation complexity 12, reference validation 12, state save 16; others at most 10. The state save warning is a justified owner complexity: one transaction validates identity, name uniqueness, project authority, finite ordering, populated-group immutability, unique default selection, and the bounded state catalog. Guard clauses keep those independent decisions visible; splitting the atomic workflow into generic wrappers would not remove them. No function exceeds 20. No lint suppression was added.

## Remaining legacy parity

- Plain task description is preserved; the rich HTML/JSON/Yjs issue editor transport is not migrated by this slice.
- Labels support create/update/read/assignment, not deletion, hierarchy, or workspace-wide labels.
- Subtasks, issue relations/dependencies, comments/activity detail, attachments, estimates, cycles/modules, custom fields, draft/intake/triage, archival/deletion, external-import metadata and advanced filter aggregates remain legacy-owned.
- Project catalog budgets are 100 custom states and 1000 labels; a task accepts 100 distinct assignees and labels. These are explicit native application bounds, not measured capacity limits.
- Task-center filtering is bounded scan pagination, not a full-text search index or precomputed count system.
