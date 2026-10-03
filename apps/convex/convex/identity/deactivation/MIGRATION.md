# Account deactivation

Backend only; UI deliberately unmounted until an operator-selected identity has been verified and authority initialized on each deployment. Legacy forbids deactivating InstanceAdmin; the native authority membership guard now preserves this invariant. No bootstrap has been invoked and no live account has been deactivated.

Legacy DELETE users/me deactivates and retains authored content. Native retains user/auth-account/content IDs, atomically disables memberships, destroys sessions and refresh descendants, and records a durable restriction. Absence of restriction explicitly means the pre-existing unrestricted account. No self-reactivation or hard deletion endpoint is inferred.

Password proof compares the exact hash returned by successful canonical retrieveAccount against the committing transaction; OAuth/email-only accounts require a session created within five minutes. Refresh does not renew this proof. Both existing JWT reads and new session creation deny restricted users. Membership grants and invitation issuer authority use the same restriction owner.

Budgets: at most 100 workspace membership records, 100 project membership records, 100 sessions and 1000 refresh tokens. Above-budget operations fail without changes. Last administrator checks include archived projects. No singleton exception is allowed. Authored content and account records remain; deactivation email, physical invitation removal, password randomization remain explicit legacy gaps. Invitations cannot be used by a restricted recipient or issued using a restricted inviter. Existing session deletion also prevents canonical refresh, whose implementation does not run beforeSessionCreation.

## Instance authority

`instanceAuthority` is a durable singleton setup lock; `instanceAdmins` is the canonical membership owner. Internal-only bootstrap checks both singleton and any existing admin, exact operator-selected verified email/user ID, and unrestricted account in one transaction. No first-user public route, environment allowlist, automatic invocation, or workspace-role inference exists. Removing membership rows cannot reopen initialized setup. Deactivation rejects any instance membership before cleanup. The read-only `instance.me` projects only the current actor boolean.

The broader inherited instance control panel (administrator roster changes, configuration, workspace management, telemetry and setup screens) remains separate. Bootstrap is an operator deployment procedure requiring verified target identity, not a public account capability. UI must remain unmounted until deployment initialization is performed deliberately.

Verification: module behavioral tests cover exact verified bootstrap identity, persistent setup lock after roster loss, instance-admin deactivation rejection, restricted bootstrap rejection, and private read authentication. Deactivation tests cover archived final admin, credential CAS, recent-session expiry, bounded rollback, restriction reads/grants/inviter and session/token cleanup. No outbound provider/email or real account mutation was used.

Public deactivation is also server-blocked until instance authority is initialized; leaving the UI unmounted is not relied on as an authorization boundary. Uninitialized direct calls leave sessions and memberships intact.
