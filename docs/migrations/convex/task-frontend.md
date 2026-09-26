# Task property frontend slice

## Ownership

`project-tasks.tsx` retains the existing quick-create and coarse status mutation journey. Task titles open a canonical detail subscription through `tasks.index.resolve`, which normalizes the URL ID and authorizes it at the backend. Detail selection is encoded in `?task=`; loaded pagination rows do not own the selected detail.

The new `tasks/` components use generated API arguments and results. Project states, labels, and eligible assignees come from their authorized owners. No Django stores or services are imported. Task fields became required after the backend backfill; the frontend does not duplicate migration defaults.

## Supported journeys

- Create a task; change coarse status optimistically using the existing paginated-query update. A changed coarse status clears custom state in both optimistic and durable data.
- Open/reload a task link; read title, description, priority, state, dates, labels, assignees; edit and save these properties together.
- Select a custom state and submit its canonical status group together. Date controls reflect the opposing date bound, while the backend validates the pair.
- Project administrators create and edit states and labels, including default state, group, color, description, and sort order.
- A task edit captures its opening revision. The backend rejects stale full-form saves if another writer changed the task; the local draft is retained for recovery, without automatic retry.
- Guest controls remain disabled/hidden. A rejected detail subscription has a local unavailable state with return navigation. Server authorization remains authoritative.

## Verification

Native web typecheck and focused Oxlint passed. Oxfmt and `git diff --check` passed. Backend module tests cover task property authorization and contracts. Primary-agent Chrome acceptance is a separate gate; this note does not assert its result.

## Remaining product scope

This slice does not implement the existing task product's subtasks, dependencies, rich descriptions, attachments, comments, cycles, modules, custom properties, activity history, or full workspace task-center filters. It adds no claim of complete legacy UI parity. Assignee choices are paginated; selected users outside loaded pages are identified as unavailable or not loaded and can be removed explicitly. Workflow state deletion has a backend API but is not exposed in this initial form.

## Primary Chrome acceptance

Saved High priority, 2026-09-27 start, 2026-09-30 due date and the authorized project writer as assignee. Created Ready for QA as the project's default custom state and Acceptance label, then created a task and verified the default state in its canonical detail; assigning the label retained that state. Task list readback displays the canonical custom state separately from its explicitly named status-group control.

Two same-account tabs exercised stale-draft protection: one completed the task while the other retained an edited title. Saving the old draft showed the conflict message and retained the unsaved text; cancel returned the unchanged canonical title with Done status. Backend tests also cover concurrent writes under a frozen clock. Deep task selection uses the URL's canonical resolver, and project-guest meeting views showed live canonical status changes without edit controls.
