# Project Trash

## Source contract and intentional recovery difference

Registered `DELETE workspaces/<slug>/projects/<uuid:pk>/` invokes
`app/views/project/base.py:382`. Active workspace administrators or project
administrators may delete. `project.delete()` inherits `SoftDeleteModel.delete`
from `db/mixins.py`: timestamp the parent and enqueue recursive related-object
soft deletion/SET_NULL. The controller also removes deploy boards/favorites and
queues a webhook. `bgtasks/deletion_task.py` later purges rows after the configured
`HARD_DELETE_AFTER_DAYS` (default 60); its restore helper is unimplemented. This is
not immediate hard deletion, despite inherited irreversible browser copy.

Native Trash deliberately retains the project and all descendant records without
cascade, purge, webhook or REST compatibility claims. The project identifier
remains reserved. Restore clears only the project tombstone: independently
trashed tasks/comments/assets and archived projects stay in their own state.
Memberships remain unchanged, including existing final-administrator constraints.
Workspace deletion is a separate unimplemented lifecycle.

## Owners and access audit

`projects/lifecycle.ts` owns administrative Trash reads/transitions using the
existing metadataRevision CAS. Its specific authority is current workspace admin
or active project admin with non-guest workspace membership. It does not grant
ordinary project access to workspace admins without project membership.

Normal `identity/access` project checks, including archived-project membership
recovery, reject deleted projects. Nullable readers independently exclude them:
`tasks/access`, `tasks/center`, `tasks/drafts/access`, `savedViews/scope` (also
favorites/recent visits/workspace cycle/module directories and graph projections),
`reporting/scope`, `meetings/access`, `mcp/access`, `commercial/delivery`,
`resources/index`, `projects/order_owner`, project list/archive list, and invitation
issuer/incoming projections. Navigation addresses and draft detail delegate to
requireProject; document task references delegate to taskCanRead. Meeting summary
reads follow requireMeeting; canonical async commits reauthorize their scope.
Internal project-order/timezone migrations may inspect retained rows and do not
expose their metadata. Workspace membership restriction retains final-admin checks
for retained projects. Creation still checks all identifiers, including Trash.

Documents are independent workspace records. Their owner/global/private access
is unchanged; nonowner project visibility ignores deleted project associations.
An independently authorized owner or another active linked project can still read
and collaborate. Project deletion does not modify Yjs state or shared files.
Live collaboration rechecks the same document context owner. Project/task asset
prepare, read and finalization use canonical scope checks; ready bytes remain
retained by the existing asset sweeper. Expired pending intents retain their usual
cleanup. No new storage deletion service is introduced.

## Additive rollout

`projects.deletedAt` is temporarily optional solely for persisted old rows;
missing means previously active. Canonical create writes null. Run every bounded
50-row lifecycle.backfill cursor page on both deployments, then repeat to prove
zero changes. Only after both receipts may the field become required and the
backfill/temporary null projection be removed. No migration has run in this slice.
Trash queries use indexed workspace pages with row/byte budgets and retain sparse
continuation; they never claim a global total.

## Verification

Module BDD covers stale CAS, identifier reservation, independent task Trash,
archive preservation, sparse cursors, member denial/current admin revocation,
workspace-admin lifecycle-only authority, invitation suppression/acceptance denial,
ready-file read denial/pending finalize denial, cross-project graph title hiding,
and independent shared document/live-context access. No destructive runtime test,
remote deployment, browser acceptance or inherited route retirement is claimed.
