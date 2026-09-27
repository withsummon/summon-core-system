# Project network discovery and explicit join (D07)

## Source contract

`apps/api/plane/db/models/project.py` defines Secret=0 and Public=2, new-project default2. Public means **workspace discovery and joining**, not anonymous publication or automatic content authorization.

`app/views/project/base.py.list_detail/list` lets workspace members discover public projects plus their memberships; guests see joined projects; workspace admins can discover all projects. `retrieve` still returns409 for a public nonmember and403 for a private nonmember. `app/permissions/base.py.allow_permission` requires an actual active project membership for content endpoints. A public flag must not synthesize a member object or widen `requireProject`.

Self-join is `POST /api/users/me/workspaces/<slug>/projects/invitations/`, `UserProjectInvitationsViewset.create` in `project/invite.py`, not the similarly named token-invitation `ProjectJoinEndpoint`. Workspace members may join public projects; workspace admins may also join private projects; guests cannot self-join. Existing membership activation preserves its prior role. New membership takes the workspace role. Source scopes project IDs to the workspace before adding membership (security fix GHSA-45hc-q4mw-jhxm).

Actual existing consumers: `core/components/project/form.tsx` Network selector, project card/join modal, `core/store/user/base-permissions.store.ts.joinProject`, and `core/services/user.service.ts.joinProject`. They remain unchanged; production route/UI/REST parity is open.

## Native owner

`projects/network.ts` supplies bounded cursor `list`, authorized metadata `get`, admin-only `save` with project metadata CAS, and explicit single-project `join` with the captured revision. Discovery returns project ID/name/identifier, network, joined/canJoin, and revision; get also returns canManage. It does not return private task contents, aggregate counts, or a fake membership role.

`join` rechecks active workspace/project state and current role/network. It delegates to the existing `grantProjectMembership`, preserving a previous membership role and project order. Ordinary `projects.index.list` remains the joined-project chooser contract, and all task/project content ACL owners remain unchanged. A separate discovery query is intentional: adding nonmembers to the old list would break its guaranteed membershipRole contract and encourage false write controls. No dual writer was added.

Network changes do not revoke existing members. Workspace administrators can change policy without implicit content read, matching the inherited settings administration boundary. Archived/deleted projects and deleted workspaces are unavailable. Foreign/nonmember workspaces cannot be discovered or joined. New project creation accepts optional explicit0/2 and otherwise uses inherited public default2; shared commercial project creation uses that same owner.

## Additive stored-data policy

`projects.network` is temporarily optional. Existing native rows had membership-only discovery; missing values are treated as0 and backfilled to0 deliberately to avoid silently publishing previously hidden metadata. This is an explicit native migration choice, not inferred legacy project data. Existing explicit public values are preserved. New rows write2 or their supplied value.

Internal backfill requests50 rows per page, limits reads to100 rows/1MiB, changes only missing fields, preserves metadata revisions and reports processed/changed/cursor/isDone. Remove optional schema/fallback/migration only after both deployments finish every page twice with zero second-pass changes. No deployment or backfill has run for this slice. Codegen generated references, including its component/schema upload phase; no running-function activation is claimed.

## Acceptance and remaining work

Six module-local behavior cases verify public discovery versus pre-join content denial, explicit real membership, outside-workspace denial, private admin discovery versus content denial, guest restrictions, preserved rejoin role, stale metadata CAS, revoked workspace membership, deleted project rejection and repeatable privacy-preserving backfill, sparse cursor continuation and retained membership after making a project private. Native TypeScript7 and six-file Oxc pass. Full working-tree backend suite passed 652 tests in 110 files at HEAD `2d3b21f267` plus this slice and concurrent D09 account work; this is an integrated source check, not an exact deployed-artifact claim. The final added sparse-page/member-retention case passes in the six-case focused suite. No browser/UI test or live deployment claim.

Still open: preserved production directory/settings/join UI wiring, exact legacy bulk project_ids request/HTTP response shape, legacy complete project-list metadata/aggregate projection, and migration policy reconciliation if actual legacy project records are imported. This backend slice is not a route-retirement gate.
