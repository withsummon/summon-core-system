# Workspace cycle directory trace

The inherited `app/(all)/[workspaceSlug]/(projects)/active-cycles/page.tsx` renders an upgrade/marketing view, not a live cross-project dashboard. Its reference describes active-cycle snapshots, burndowns and high-priority work. The separate `WorkspaceCyclesEndpoint` in `apps/api/plane/app/views/workspace/cycle.py` returns current-member, nonarchived projects' nonarchived cycles with issue counts. The service also references a paginated active-cycles endpoint whose implementation is not present in the searched CE app routes. These facts must not be merged into a claim of inherited active-dashboard parity.

Native `cycles.index.list` is project-only, with no workspace index. A workspace page cannot safely fan out over the bounded project list or claim complete cycle coverage from those results. Required owner: indexed paginated workspace cycle query, filtering current membership and project/cycle lifecycle, projecting canonical project identifier alongside each row. Stable query arguments retain loaded pages; the shared pure cyclePhase function and minute/focus clock keep displayed phase current without resetting pagination.

Proposed presentation is a workspace directory with cycle name, project, dates/timezone and Current/Upcoming/Completed/Unscheduled phase, each linking to its canonical project cycle detail. Load more remains available on sparse pages; only exhausted empty directory claims no cycles. No invented aggregate counts, burndowns, progress snapshots or capped project fan-out. Existing project cycle details and creation remain their owner.

## Implementation and verification

`cycles.workspace.list` uses the workspace/deleted/archived index and shared page budget (1–100 items, 100 scanned candidates and 1 MB maximum read). The existing projectReader owner checks only referenced projects on the bounded page, filters archived projects and inactive membership, and returns canonical project metadata. Sparse pages retain the server cursor; neither the server nor browser enumerates a capped project directory.

The existing project cycle minute/focus clock is extracted once and reused by the workspace directory. Query arguments remain stable as time changes; display phase uses the stored cycle timezone and shared pure cyclePhase owner. The directory includes current, upcoming, completed and unscheduled cycles, excluding archived/removed records. No progress/count/burndown metric is inferred.

Three module behavior tests cover lifecycle exclusions, canonical project identity, sparse continuation, guest current-project membership, revocation, foreign workspace denial and invalid page size. Native backend and web TS7 pass, full backend suite418 tests passes, and focused Oxc is clean. These checks used installed binaries directly while pnpm metadata verification reported an unrelated patchedDependencies change; no install or lock edit was performed. Primary confirmed backend checkpoint 0b790b96c7 deployed on both hosts. Sidebar module=cycles and the Workspace cycles personal shortcut are now active; the old shortcut project-directory query and project-required placeholder are removed. The existing shortcut behavior test now verifies the workspace destination carries no project or project-view selector. All 39 native frontend tests and scoped Oxc pass. Browser desktop/390px acceptance remains primary-owned.

### Root browser acceptance, 2026-09-27

Backend `0b790b96c7` deployed to local and remote hosts. Chrome against local
`http://127.0.0.1:3010/core?workspace=northstar-convex-qa&module=cycles`
showed the two existing cycles, with Unscheduled and Current phases and canonical
project identity. Desktop and 390px screenshots were inspected: rows wrap without
horizontal overflow. Opening Release verification updated reached its exact
project/cycle deep link and rendered dates, timezone, phase and description.
Temporary viewport override was cleared. This is local rendered acceptance;
remote directory frontend and inherited route cutover are not claimed.
