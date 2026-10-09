# Invitation delivery and preserved onboarding entry

Inherited `WorkspaceInvitationsViewset.create` creates invitations and queues
workspace_invitation mail with `/workspace-invitations/?invitation_id&slug&token`.
`WorkspaceJoinEndpoint` checks token plus authenticated matching recipient on
acceptance; its public GET omits tokens. Separately,
`UserWorkspaceInvitationsViewSet.create` accepts selected IDs belonging to the
signed-in email without requiring pasted tokens. Both are real production flows.

## Native owners

- `invitations.email.send/resend` reuse canonical issue/rotate and the shared
  Resend sender. Production actions return ID plus sent/failed delivery, never the
  token. Links use the trusted SITE_URL origin and inherited path/query. Resend
  rotates the token under captured invitation revision; provider idempotency keys
  are stable per revision. Missing mail configuration creates no reservation.
- Delivery status is stored against the exact invitation revision. Failed mail
  leaves the pending invitation and an honest failed status; explicit resend
  obtains a new token. An interrupted action may leave no delivery receipt; there
  is no automatic guaranteed eventual delivery. No raw token is stored in the
  invitation table. Existing manual-sharing actions remain solely because current
  QA consumers use them, pending their retirement.
- Token preview verifies pending state, expiry and current issuer authority, then
  returns only invited email, role, workspace/project names and identifiers, and
  invitation-bound logo bytes. No inviter email, roster, token hash, storage ID or
  permanent storage URL is exposed. Logo resolution reuses workspaceLogo, with
  another invitation/asset check after reading bytes. Generic asset access stays
  unchanged and still rejects anonymous requests.
- Authenticated incomingPreview uses current verified matching recipient instead
  of token proof. respondIncoming and bounded acceptIncoming (one to twenty
  distinct captured ID/revision selections) reuse the existing response/grant
  transaction. Expiry, issuer authority, account restriction and CAS are enforced
  at commit; one failed selection rolls back the entire selected batch. The token
  path retains its token requirement. Incoming pages now omit invitations whose
  issuer no longer has authority, rather than listing unusable stale metadata;
  sparse pagination retains the canonical cursor.

## Limits and evidence

Authenticated inherited invitation writes have no per-invitation cooldown:
`WorkspaceInvitationsViewset` has no throttle override and default DRF throttle
is anonymous-only. No new cooldown is invented here. Trusted ingress/IP limiting
remains a separate public rollout gap. Resend-only is the explicit product policy.
No real email or backend deployment was performed; production route wiring stays
with the preserved-UI owner.

Module tests cover actual mocked delivery URL, failure/resend, verified acceptance,
wrong recipient, stale/expired/revoked/restricted invitations, exact logo bytes,
revocation and rotation during byte read, unchanged generic asset denial, and
batch rollback after an earlier grant. The deactivation inbox expectation was
updated to current-issuer filtering; rejection and membership atomicity remain.

Verification: 107 related identity/invitation tests passed across 23 files, native
TS7 passed, touched Oxc and formatting passed. Classic complexity maximum is 12
(the incoming-page callback); shared response owner is 11 and logo read owner is 8. Cognitive review: Clear. Token and signed-in-recipient proofs converge on the
same response/grant transaction; delivery and logo reading have explicit async
reauthorization boundaries. No parallel membership store or generic asset bypass
was introduced.
