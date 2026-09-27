# Connected accounts and account lifecycle trace

## Read-only inventory

`identity/accounts/index.list` reuses the installed authAccounts owner and current live-session authorization. It pages the userIdAndProvider index at the shared bounded page budget and projects only row ID, provider ID/display label, creation time and configuredForSignIn. It never returns providerAccountId, password secret/hash, email-verification address, tokens, refresh chains, or another user's accounts. Password requires existing secret material; email-code/OAuth configuration follows the existing server configuration owners. Configured does not assert successful real-provider authentication. Unknown or disabled provider records remain visible without being declared usable. No total is fabricated from a partial page.

Three BDD cover strict projection/privacy and pagination, disabled/configured OAuth capability, and anonymous/revoked-session denial. No mutation, provider unlink, account deletion or deactivation endpoint is added.

## Inherited lifecycle and required owner plan

Legacy DELETE users/me maps to UserEndpoint.deactivate, not content deletion. It blocks instance administrators, checks workspace/project administrator succession, deactivates memberships, removes outstanding email invitations/sessions, resets onboarding and password, marks the user inactive with logout time and queues notification email. Auth adapter complete_login_or_signup explicitly blocks previously deactivated identities; no self-reactivation endpoint was found. Stored authored content remains. Legacy AccountEndpoint deletes an owned linked account without checking the last usable method; the native migration must not reproduce account lockout.

A future deactivation owner needs an explicit durable user status, current-session/recent-auth confirmation, current project/workspace final-admin guards including archived projects, bounded membership/session/invite cleanup with resumable progress and immediate access denial during cleanup. Supported Convex Auth beforeSessionCreation must reject deactivated identities; liveIdentity must reject existing JWTs as well. Recovery semantics and administrative authority must be explicit before exposing an irreversible-looking control. No current plan deletes authored tasks/documents/accounting records or invents transfer ownership.

A future unlink owner must retain another configured usable sign-in method, recheck the actor/session and target account at commit, and atomically invalidate associated verification codes and affected sessions. A disabled provider is not a recovery method. Current inventory is not an unlink authorization projection; fresh proof and the canonical mutation must determine that separately. OAuth-only users need email/active-provider proof rather than a fabricated password. Raw provider tokens are not persisted by native Convex Auth, unlike legacy Account serialization.
