# Task lifecycle frontend

## Canonical visibility

The generated task detail projection owns `canEdit`, `canArchive`, `canUnarchive`, `canDelete` and `canRestore`. The frontend consumes these flags without reimplementing creator/admin recovery policy. Ordinary active task lists and the workspace Task Center use the backend's active visibility contract. Recovery lists are project-scoped and paginated; there is no all-project fanout.

`project-tasks.tsx` adds Active, Archived and Trash views using `taskView=archived|deleted`. The active query is skipped while opening detail or recovery views. Empty filtered candidate pages retain Load more and do not claim the project has no tasks. Project overview remains confined to the active list.

`tasks/lifecycle.tsx` owns bounded recovery listing and explicit lifecycle confirmations. Each confirmation captures the displayed task revision. Errors retain the confirmation and do not silently retry with a newer version. Archive is available only through the generated capability; deletion and recovery use separate flags. Confirmation states that child content and links remain stored, and restoring an archived task leaves it archived.

## Detail and retained links

The existing TaskDetail remains the shared active/archived detail owner. Archived details render read-only metadata, rich description, structure and comments; edit/subscription controls are unavailable. Trash uses the recovery query, validates the selected project and shows authorized metadata/plain description without invoking ordinary deleted-task child queries. Full rich content, comments and structure remain stored for restoration. The local task boundary preserves Back to tasks for a task deleted or revoked while open.

Parent queries now return `{task, hasParent}`. A hidden parent renders an unavailable label and retains an authorized detach action. Relationship and meeting rows similarly render a placeholder instead of hidden task content, while authorized cleanup uses the retained link identity. Cycle/module wrappers expose only task identity/revision for inactive links: editable groups can detach using captured task/group versions without showing an inactive task title or body. Ordinary readers do not receive these cleanup rows. Group task links clear a stale Trash route parameter before opening readable detail.

## Files and verification

Owners changed: project-tasks.tsx; tasks/{task-detail,task-structure,lifecycle}.tsx; cycles/tasks.tsx; modules/tasks.tsx; meetings/meeting-tasks.tsx; the project-overview condition in core-workspace.tsx. Existing forms, editor, task query owner and membership policy are reused. No generic lifecycle compatibility adapter was added.

Scoped Oxc lint passed with zero warnings/errors on eight files. Native web TypeScript 7 passed. Module-local backend lifecycle/structure suites passed 10 cases; the primary owns final integrated results. Browser QA is pending: complete/cancel then archive, archived read-only detail, live deletion in a peer tab, creator/admin Trash visibility, restore retaining archived status, unavailable-parent detach, relation/meeting cleanup, cycle/module cleanup freeing retained membership, stale lifecycle confirmation, and constrained width.

No deployment or commit was performed by this frontend task. Backend stored-row backfill and required-field tightening are separately coordinated. This does not claim permanent purge, retention administration, bulk archive/restore, workspace-wide trash aggregation or full legacy task lifecycle parity.

## Primary local acceptance, 2026-09-27

Primary integrated checks passed: 271 backend tests / 32 files, 19 frontend tests, 30 native typecheck tasks, 21 lint tasks and 21 formatting tasks. Local deployment and bounded stored-row backfill are recorded in the backend receipt. These checks do not establish remote production acceptance.

Chrome owner journey: NSTAR-1 (Done) archived, disappeared from active list/overview, remained readable with original rich description/comment/relationship and no editing controls. Moving it to Trash preserved authorized metadata while guest Trash contained no task. Restore retained archive state and original comment/relationship. A live module view showed a title-free unavailable placeholder while archived, then the original task button returned after unarchive without recreating membership.

QA found and repaired a task crosslink retaining taskView=archived and restore returning to an empty Trash list. The repaired crosslink opened active NSTAR-2, and a repeated Trash/restore journey navigated to Archived with NSTAR-1 visible. Lifecycle navigation now selects the destination view for each operation. Cycle assignment additionally closes when canonical editing permission disappears.

Desktop and 390-pixel recovery navigation were inspected; constrained document scrollWidth equaled 390, controls were readable, and temporary viewport overrides were reset. The first browser viewport capability did not resize the existing tab; measured CDP emulation supplied the actual constrained-width evidence.

Remaining browser matrix: individual inactive parent/meeting/cycle cleanup actions, stale lifecycle confirmation, and full deleted-detail/revoked-role permutations. Their server contracts are covered by module-local behavior tests; no exhaustive browser claim is made. Full inherited feature parity, public API compatibility and remote acceptance remain retirement gates.

## Committed isolated acceptance, 2026-09-28

`c91587b711af358e6ef8f2a936d928f9bf0f29c7` removes the catch-all detail boundary and duplicate task resolver. The authenticated read owner returns `null` for missing/unreadable tasks and mismatched recovery views; malformed addresses and unauthenticated requests retain their strict errors. Child queries mount only for an authorized present task. Recovery still requires its actual creator or project administrator; write CAS remains strict.

Chrome served the immutable client at `http://localhost:3021/core` against the exact isolated backend at `http://127.0.0.1:3220`. Client SHA256: `450130503581de02f759f0ebf83b9d99085bf535379d5b517358f70cd0f55f73`; backend subtree: `f672f7fcb80af317608fcfa0b245cbfa62431520`. The journey mounted the real child queries, archived the task, moved it to Trash, restored it while retaining archive state, and unarchived it. Properties became read-only while archived and editable afterward; rich bold/italic/list content survived. No console errors occurred in the journey. The complete 634-event sanitized capture observed no Django requests: `/tmp/summon-task-nullable-read-chrome-network-20260928.json`.

Separate public-owner checks verified raw invalid/wrong-table IDs, absent valid addresses, recovery-view mismatches, authentication before lookup, and rejected stale deletion leaving the canonical task unchanged. The frozen tree passed all 30 TypeScript tasks, toolchain enforcement, scoped strict Oxc lint/format and the web build. This proof covers the native `/core` task owner; preserved production Browse, Peek, Intake redirects and their full dialogs/commands remain open.

The shared Popover trigger now forwards its native button ref on React 18 (`1a131b7366`). Actual Chrome clearing retained focus on the due-date trigger while saving, after the previous source-only fix failed that interaction. The capture does not establish Enter/Space suppression during the pending interval: those keys were exercised after acknowledgement.
