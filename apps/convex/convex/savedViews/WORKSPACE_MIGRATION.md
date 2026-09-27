# Workspace saved views: bounded native slice

## Owner and public contract

The existing `savedViews` and `savedViewFavorites` tables remain the only definition/favorite owners. A non-null `projectId` identifies a project view; null identifies a workspace view. `workspaceId` is canonical for new rows. Existing project endpoint arguments and result shapes remain available for the currently served build.

`workspace.ts` provides access/list/create/get/resolve/update/lifecycle/favorite/favorites/results. Definitions use the same `viewFilters` validator, shape/date validation and `matchesFilters` evaluator as project views. `result_page.ts` is the single bounded task producer for both scopes; the project endpoint unwraps its task rows to preserve its public contract. Workspace results return `{task, project:{id,name,identifier}}` and `viewUpdatedAt` alongside the pagination cursor. All results are newest-created, at most 100 candidate rows and 1 MiB per page. Filtered empty pages retain continuation; no global totals are claimed.

The lifecycle is owner edit of unlocked rows; owner or workspace administrator soft removal/recovery. Lock is persisted/enforced but has no new public toggle. Favorites are personal, retained across removal but hidden until restoration, and guests cannot change them. Workspace guests can create and read their own workspace views; this applies consistently to list/detail/results. Names/descriptions use the existing 255/10,000-character owners. Scope is immutable.

## Authorization and metadata

Every endpoint requires current active workspace membership. Each result candidate additionally requires its own current active project membership and active project. Workspace administrator status does not grant project access. A guest in either scope sees only their own tasks unless that project's guest-view-all flag permits other tasks. Canonical `taskIsActive` excludes triage, archived and deleted tasks.

Workspace state/label directories use bounded workspace indices and filter each candidate through current project membership. Saved selected IDs remain present, but their names become null after project access is revoked. Updating a definition that still references an inaccessible taxonomy value fails explicitly; the user can remove that clause. Users are workspace-directory identities: selection/directory names require current active workspace membership of that selected user, not visibility inferred from an inaccessible project's roster. Stored inactive workspace user IDs remain removable with null names. User filter validation accepts recorded workspace membership, including inactive historical members, matching historical creator filtering; that never grants access to a task.

## Additive deployment and backfill

1. Deploy this additive schema with optional workspaceId on both tables. New project and workspace writes initialize it. **Temporary project-read migration contract:** existing project APIs authorize and derive workspace ownership through the stored projectId and `requireProject`, so old project rows remain readable before backfill. Workspace-only rows must have a stored workspace owner and fail explicitly if missing; no guessed owner is used.
2. For each deployment, run `internal.savedViews.migrations.workspaceScopes({table:"views",cursor:null})`, then continue each returned cursor until isDone. Repeat for `table:"favorites"`. Each transaction handles at most 50 rows/1 MiB. Missing source projects or ownerless workspace rows fail for explicit repair. Record changed totals, then repeat each complete traversal and require zero changes.
3. Only after local and remote backfill receipts both prove completion, make workspaceId required on both schema owners and remove the temporary optional/read transition. This cleanup belongs to the deployment owner; this patch does not claim that either deployment has been backfilled.

The backfill changes only workspaceId. IDs, view revision timestamps, definitions, deletion state and personal favorite records remain unchanged. Tests cover pre-backfill project reads and idempotence for both tables. No hard deletion or conversion of existing project views occurs.

## Legacy trace and remaining parity

Legacy owners are `apps/api/plane/app/views/view/base.py` (`WorkspaceViewViewSet`, `WorkspaceViewIssuesViewSet`), workspace services and `store/issue/workspace` consumers. Legacy workspace guest list visibility is own-only; this native slice applies the same restriction to detail rather than reproducing the inherited detail/list inconsistency. The results producer preserves the important per-project membership and guest-created-task boundaries.

Still staged: legacy REST/PAT compatibility and IDs; nested rich filter grammar; additional field predicates and project-selection clauses; alternate ordering/manual ordering; grouping, counts, layout/display persistence and static built-in views. This slice supports the existing typed status/state/priority/assignee/label/creator/date filters with all/any semantics only. It does not retire Django routes or claim full workspace-view parity.

## Verification

- 12 saved-view BDD scenarios: 6 existing project scenarios plus 6 workspace scenarios, including sparse pages, workspace-admin isolation, guest visibility, revocation redaction, cross-workspace taxonomy rejection, favorites/lifecycle CAS and migration preservation.
- Native TypeScript 7 passed; scoped Oxlint and complexity <=10 passed. Complete backend suite passed 318 tests across 39 files after the final foreign-scope regression.
- Independent read-only owner review sampled access, projection, pagination, favorites and migration ownership; no blocking finding reported.
- Backend source verification only. Browser acceptance and deployment/backfill evidence are separate parent-owned gates.
