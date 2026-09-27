# Workspace recoverable Trash (D05)

**Status: native recoverable lifecycle implemented; inherited DELETE-route parity remains OPEN.** Slug release/profile clearing and preserved production UI integration are not closed, so this slice is not a retirement gate.

## Legacy boundary and intentional policy

Registered `DELETE /api/workspaces/<slug>/` maps to `WorkspaceViewSet.destroy` in `apps/api/plane/app/views/workspace/base.py`: workspace administrators only; it clears matching profile last-workspace pointers then calls the model delete. `db/models/workspace.py` suffixes the slug after soft deletion. The shared soft-delete machinery schedules descendant handling; later purge is a separate legacy retention owner. It is incorrect to describe this endpoint as an immediate hard-delete.

The preserved production UI is `core/components/workspace/delete-workspace-{section,modal,form}.tsx`, through `core/store/workspace/index.ts.deleteWorkspace` and its REST service. It remains unchanged. Its current store catch logs and swallows errors; future native integration must preserve the visible workflow while correctly propagating failure, not inherit that false-success behavior.

Native policy is recoverable **ancestor-only** deletion: retain slug, memberships, all child rows, archive/deletion flags and ready asset bytes. No cascade, purge, role grant, profile fan-out or destructive runtime operation. Existing independently deleted assets still follow their existing retention policy. Native last-workspace preference is retained but destination excludes deleted workspaces; no tombstoned workspace can become the post-login destination. This differs deliberately from clearing every legacy profile pointer and releasing the slug.

## Canonical owner and bypass closure

`workspaces/lifecycle.ts` owns `get`, paginated `list`, and `setDeleted({workspaceId, deleted, expectedRevision})`. Only a currently active workspace administrator can inspect/recover Trash. Project administration is insufficient. The existing workspace metadata revision provides atomic CAS across settings/logo/lifecycle. Repeated same-state operation is a no-op only after fresh CAS validation. List paginates the caller's membership index and preserves sparse continuation.

`identity/access.requireWorkspace` rejects the ancestor before ordinary content authorization. Project/task/intake, independent document ownership, authenticated file descriptors/bytes/finalization, editor collaboration context/save and private workspace domains inherit this gate. Unlike project deletion, even an independently owned/global document is unavailable while its **workspace** is deleted.

Nullable/private read owners also check the ancestor: `tasks/access.taskCanRead`, `savedViews/scope.projectReader` (including triage discussion), `documents/access.canAccessDocument`, `meetings/access.canReadMeetingProject`, and `mcp/access.credentialMetadataAccess`. Notification selection/delivery/mentions reuse the task/discussion owners. `invitations/access.issuerAccess` denies acceptance/new authority and incoming hides the workspace metadata. `workspaces/index.list` and `identity/preferences.destination` exclude it. Address resolution already calls requireWorkspace. Asset avatars are global user assets: own-avatar access remains independent; another member's avatar requires current workspace access.

Account deactivation still checks every active admin membership, including retained tombstoned ancestors. A sole admin cannot abandon recovery authority; the existing rejection remains intentional. Recovery first permits ordinary membership administration if an admin needs to appoint a successor. No bypass grants were added.

## Additive rollout

`workspaces.deletedAt` is optional solely for stored-data rollout; missing means old active row. New workspace creation writes null. Internal `backfill({cursor})` scans at most 50 requested rows with 100-row/1MiB read limits, changes only missing fields, preserves revisions and existing tombstones, and returns processed/changed/cursor/isDone.

Require the field and remove this migration only after both exact deployments finish all cursor pages twice and the second full pass reports zero changes. Neither deployment nor backfill has been performed for this slice. Codegen regenerated bindings and logged component/schema upload; no `deploy` or `dev --once` was run, and this is not a running-function activation claim.

## Verification boundary

Eight module-local behavior tests cover fresh/stale recovery, reserved slug and independent child Trash, current/revoked admin authority, destination exclusion, nullable notification access and pending invitations, ready bytes/pending upload plus document live context, nullable MCP metadata, sole-admin deactivation, repeatable bounded backfill, and sparse/foreign-workspace pagination. Final full backend suite passed 639 tests across 108 files, including all eight lifecycle cases. Native TypeScript7 and scoped Oxc passed. Final source gate is against HEAD `e65ece98e6` plus this scoped lifecycle diff; sibling auth policy is already committed there. Live websocket disconnect timing, browser deletion/recovery and deployed REST compatibility remain unverified. No UI was created or switched.
