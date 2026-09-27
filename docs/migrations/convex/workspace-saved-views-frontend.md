# Workspace saved views frontend

## Boundary and experience

The workspace `Views` module extends the already inspected saved-view list → detail/results → explicit editor workflow. The Linear/Jira reference evidence and comparison remain in `saved-views-frontend.md`; no new layout or design-system replacement is introduced. Workspace identity is visible above the view name, and each matching task identifies its own project. Project-scoped views remain in the project `Views` section. Workspace module navigation replaces search parameters; workspace switching also replaces them and remounts its module owner. An explicit workspace-detail scope check prevents a stale or pasted view ID from rendering under another workspace.

The backend owns separate workspace endpoints while preserving project endpoint argument/response contracts. The frontend therefore shares domain UI, not endpoint configuration: `ViewDefinitionForm` captures the initial definition/revision and delegates its explicit save; project and workspace controllers own their generated hooks. Filter controls, unavailable draft selections, saved-filter summary, favorite control, lifecycle confirmation, and result rows are reused. Workspace taxonomy/member directories are independently paginated; no project fan-out.

## Canonical navigation and concurrency

A workspace result provides its canonical task and project. Shared task-link composition switches to the Projects module, sets that project identifier/task ID, preserves the workspace, and removes stale view/archived/trash/intake/group selection. No selected-project prefix is inferred from the origin URL.

Definition and lifecycle confirmations retain captured revisions. Live definition changes reset only the result cursor. Current task result changes remain subscription-driven. Selected historical or disappearing draft choices remain removable through the existing choice owner. Display labels use the current authorized selection projection, while the mutation snapshot retains its original revision and draft. No global count, grouping, or arbitrary ordering claim; newest-created order is backend-owned.

## Verification

Three module-local behavior tests passed, including cross-project result navigation and disappearing draft choices. Scoped ten-file Oxlint passed. Native web TS7 passed against the generated workspace endpoints, and diff whitespace checks passed. Remaining browser cases: sparse load-more, concurrent workspace edit conflict and membership revocation during an open editor. These have backend/source coverage, not browser completion. No dependencies were added.

## Primary local checkpoint

318 backend tests across 39 files and 25 frontend tests passed. Root native TS7 passed 30 tasks after correcting shared component inputs to the generated project/workspace detail union; Oxc lint and formatting passed 21 tasks each. Local functions deployed at 14:12:17 on 2026-09-27. Ownership backfill changed one existing view and one favorite; second complete scans changed zero for both tables.

Chrome created “Workspace open delivery” (To do) and displayed QADEL-1 alongside NSTAR tasks. Clicking QADEL-1 opened its own project and canonical task. The restricted account saw only its permitted NSTAR-5 task; this account is a project guest, so the observation is not evidence for the distinct workspace-guest definition rule. Favoriting, removal and restore preserved the personal favorite; removal made the restricted account's open view unavailable. The prior project view retained its same ID, name, favorite and matching results after backfill. Desktop and 390px screenshots were readable, with narrow scroll width equal to viewport width; viewport override cleared.

Remote backfill and second zero-change scans passed for both tables. Commit `2d22f081b8` makes ownership required and removes the migration endpoint/guard; the transitional migration behavior remains in commit history and `checkpoints/workspace-scope-backfill.json`. Both required-schema deployments succeeded. The final primary suite passed 318 backend and 25 frontend tests, 30 native type tasks and 21 lint/format tasks. The production build and exact served index passed; `checkpoints/2d22f081b8-remote.json` records remote create/live exclusion/reinclusion browser evidence. Full inherited rich-expression and layout contracts remain staged; Django routes are retained.
