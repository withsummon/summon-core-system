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

Immutable backend f0f352d6a8 passed native TS7 and 38 workspace/project/invitation tests. Its local deployment succeeded; its remote evaluate_push failed with HTTP499. Follow-up c805eb16cc adds the current workspace slug to the project-leave result and passed immutable TS7/local deployment; its remote retry failed at evaluate_push with HTTP504 Gateway Timeout. Remote /version remained reachable with HTTP200. No remote deployment success is claimed here; the runtime/proxy owner must resolve this before the remote checkpoint. Browser leave acceptance is pending parent QA. The inherited REST routes remain until a separately reviewed route cutover; this native owner is not a REST adapter. Account deactivation retains its separate account-level cleanup budget and identity/session policy.

## Native confirmation and recovery UI

A workspace leave control appears in its sidebar; project leave appears for the selected active project and each archived project row. Opening confirmation captures the exact typed scope and displayed name. The confirmation describes loss of access and retention of content. Failures keep the confirmation/error local; last-administrator rejection does not navigate. Success returns to `/core` after workspace leave or to the current workspace slug returned by the project mutation, clearing stale project/domain selections. A renamed-workspace response regression verifies the return address.

Workspace-bound sidebar/main subscriptions now have a local membership boundary, since revoked queries can reject before the workspace-list subscription removes their subtree. Recovery returns to the workspace chooser without latching the application-level error boundary. Workspace-keyed boundaries and project-keyed controls reset captured state across navigation. Native web TS7 and four-file Oxc pass; rendered interaction and constrained-width assessment remain pending parent QA.

## Root Chrome recovery acceptance — 2026-09-27

The isolated Workspace rename QA sole administrator opened the named leave confirmation and submitted it. The server rejected with “Assign another workspace administrator first.” Workspace settings and membership remained available. Cancel initially left the error visible; the confirmation owner now clears its own error on cancel. Repeating rejection and Cancel in Chrome verified both the confirmation and error disappear. Scoped Oxlint and Oxfmt pass. This read/rejection journey does not claim browser acceptance of successful membership revocation; module behavior tests cover that transition.
