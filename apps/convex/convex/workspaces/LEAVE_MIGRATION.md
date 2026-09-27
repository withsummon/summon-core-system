# Workspace and project self-leave

## Legacy boundary

`apps/api/plane/app/urls/workspace.py` registers POST `workspaces/<slug>/members/leave/`; `WorkSpaceMemberViewSet.leave` admits active admin/member/guest, protects the last workspace administrator, checks project administrator constraints, and deactivates the caller's active project memberships in that workspace before their workspace membership. No content deletion occurs.

`apps/api/plane/app/urls/project.py` registers POST `workspaces/<slug>/projects/<project_id>/members/leave/`; `ProjectMemberViewSet.leave` admits current admin/member/guest and protects the last active project administrator. The decorator and lookup do not filter archived projects. Native self-leave deliberately allows archived projects through the existing lifecycle membership owner, while ordinary archived content remains read-only/unavailable as before. Current native workspace membership is still required.

## Canonical owners

`workspaces.index.leave({workspaceId})` derives the current caller through `requireWorkspace` without requiring writer status, then delegates to the same extracted `revokeWorkspaceMembership` used by administrative revocation. This owner performs last-workspace-admin protection, shared project restrictions and the workspace deactivation atomically.

`projects.index.leave({projectId})` loads the exact project, uses `requireProjectMembership` to authorize the caller (including guests/archived projects), and invokes the same extracted project revocation owner as administrative revocation. There is no client-supplied target user or administrator impersonation.

The existing project restriction owner is reused by workspace leave, administrative workspace revocation and guest demotion. It now reads the `by_workspace_user_active` index and loads at most `MAX_ATOMIC_PROJECT_MEMBERSHIPS + 1` rows. The explicit budget is 100 active project memberships. Overflow rejects before any writes; it never silently truncates a cascade. Inactive history does not consume this budget. All active project-administrator checks complete before any project membership mutation, including archived projects. Native final-admin protection is stronger than the legacy workspace leave query that tested total project member count rather than counting active administrators.

No tasks, documents, favorites, recent visits or other content are removed. Existing current-membership read boundaries hide inaccessible data immediately after leave. Invitations or administrative grants can restore access through their existing canonical authority rules. Other workspaces and their projects are unaffected. Repeating leave without active membership fails current authorization rather than impersonating a successful new operation.

## Evidence and rollout

Eight new module-local BDD scenarios cover member/guest archived-project leave, last workspace/project administrators, workspace cascade atomicity, foreign-workspace/project retention, stale workspace access, 101-active-project overflow for leave/revoke/demotion, inactive-history exclusion and concurrent administrator departures. Existing workspace/project/invitation tests are rerun with this shared-owner extraction. Native TS7 and scoped Oxc are required before deployment.

No deployment or browser leave was performed at this source checkpoint. The inherited REST routes remain until a separately reviewed route cutover; this native owner is not a REST adapter. Account deactivation retains its separate account-level cleanup budget and identity/session policy.
