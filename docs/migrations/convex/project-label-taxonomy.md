# Project label taxonomy

## Registered inherited behavior

The inherited label settings UI owns admin create/edit/color/order, parent groups, ungrouping and deletion. Its delete confirmation promises removal from tasks and saved-view filters. Although the Django model allows a null project, the registered workspace label endpoint only lists labels from active member projects; it does not expose workspace-global creation. Native document labels reuse this directory. No global taxonomy CRUD is inferred from the nullable column.

## Native owner

`tasks/labels.ts` now owns captured label revisions, case-insensitive project name uniqueness and cycle-safe groups. Groups retain label identity and may still be assigned. The existing project maximum is 1,000 labels; hierarchy has a named 20-level bound. Whole-tree validation protects descendant depth during moves. Numeric order stays explicit; drag-and-drop ordering and bulk creation are not yet implemented.

Additive optional `parentId`, `revision`, `retiring` fields were deployed in `f943474b1b`; primary verified both-host backfill and zero-change rescans before required-field cleanup. New producers write all fields. Temporary migration code is removed after these receipts.

`label_removal` freezes a group and its descendants before scanning references. Each user continuation scans at most 20 task candidates (bounded notification fanout), or 50 draft/document/view candidates. Tasks use canonical `taskChanged`; unpublished draft cleanup increments contentRevision and updatedAt; document cleanup advances metadata timestamp; saved-view filters advance their captured revision timestamp. Published drafts remain historical snapshots, consistent with estimate retirement, and cannot be copied or republished into a different task. Source labels are deleted only after all scan phases finish. Guards in canonical task creation/properties, draft copy commit, saved-view validation and document assignment block new references during retirement. Cancellation is possible before the first cleanup step; later cancellation cannot promise rollback.

No global reference counts are claimed. Progress reports only changed rows and the current phase. Jobs and document links use bounded indexed pagination. The retained job is a resumable owner record, not browser cache.

## Verification and remaining acceptance

Behavior tests cover case-insensitive names, group cycles, stale edits, freeze against new assignment, active saved-view readability while retiring, cleanup across all four reference owners, and cancel-before-start. Exact classic complexity: label save 12, group validation 15, retirement step 14. Backend native TypeScript and scoped Oxc pass. Backend commit `7603af9f65` passed TypeScript from its immutable archive and was deployed to local `http://127.0.0.1:3210` and `https://convex-core.withsummon.com`; CLI logs are `labels-7603af9f65-{local,remote}-deploy.txt` in the migration-control directory. The replacement label/group management UI is mounted; web TypeScript, scoped Oxc and all 40 frontend tests pass. Primary Chrome runtime and visual acceptance remain pending.

Remaining inherited parity includes drag-and-drop group/order controls, bulk project label creation, and fuller label filtering/navigation. Workspace-global label creation has no verified registered product owner in this checkout and is not claimed.

## Primary Chrome acceptance

Local `http://127.0.0.1:3010/core?workspace=northstar-convex-qa&module=projects&project=NSTAR`, September 27:
created `Migration QA group` and nested `Migration QA child`; hierarchy rendered with indentation. Moving the group under its child rejected with the ancestry error and retained the chosen parent. Cancel kept the valid tree. Preparing deletion marked both rows Removing and disabled editing; cancelling before cleanup restored editing. No irreversible browser deletion was executed; reference cleanup remains backend BDD evidence. Both labels remain as QA fixtures.
