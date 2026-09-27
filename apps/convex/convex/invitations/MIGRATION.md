# Workspace and project invitations

## Traced owner

Legacy WorkspaceInvitationsViewset uses WorkSpaceAdminPermission, whose actual implementation admits both workspace admin and member. Creation rejects roles above issuer rank. ProjectInvitationsViewset.create has ADMIN decorator. Acceptance requires token and current authenticated case-insensitive email; project acceptance creates missing workspace membership capped at member for project-admin invitations. Native uses exact project lookup rather than legacy's erroneous workspace-only project-member lookup.

Native invitations table owns requested scope/email/role, issuer, SHA256 token hash, seven-day expiry, revision and response state. `tokens.create` and `tokens.rotate` generate32 random bytes in Node actions and return the manual-sharing token once. `tokens.respond` hashes input before calling the internal atomic consumption owner. Public queries omit hash; no raw token persists. Context7 runtime documentation confirms mutation determinism and seeded Math.random: secure randomness therefore belongs to Node action `node:crypto`, not mutation Math.random. Reference: https://docs.convex.dev/functions/runtimes . No Mintlify tool was available; Context7 was used.

## Authority and membership

Issuance permits active workspace admin/member up to own workspace rank; project issuance additionally requires active project admin and non-guest workspace role. Acceptance rechecks original issuer's current authority, exact nonarchived project/workspace scope, current verified recipient email (`emailVerificationTime`), token, pending state and expiry. No email-based identity lookup/link/create occurs; only the authenticated user ID receives membership. Wrong/unverified/changed email, stale/revoked authority, expired/rotated/consumed token grants nothing.

Workspace and project index grant mutations now delegate to extracted internal canonical membership writers; their public admin gates are unchanged. Invitations invoke those writers after capability authorization, with no impersonated administrator. Existing active memberships retain role (including administrator); invitations do not silently promote/demote them. Project invitations can create missing workspace membership because issuer is an active workspace writer authorized to invite at that capped role. Existing active/inactive workspace guests cannot gain writer access through a project invitation. This preserves native guest restrictions and protects final-admin/demotion behavior through the canonical owner.

Queries are bounded with canonical pagination budgets. Scope lists require current issuance permission; incoming lists require verified matching current email. Expiry is enforced at response time; query Date.now is not a promised scheduled reactive disappearance. Rotate captures revision, replaces hash and issuer, extends expiry; revoke captures revision. Already consumed invitations cannot replay. Existing pending invitations require rotation/revocation rather than silently overwriting capability.

## Evidence and staged work

Seven invitation behavior tests plus14 existing workspace/project membership tests pass. Coverage includes hash-only persistence, response replay/concurrency, rotation/expiry, current issuer revocation, exact recipient verification, member rank, guest denial, crossscope forgery, project-to-workspace role cap, no active-admin downgrade, guest rollback and decline without grants. TS7 and scoped Oxc/format pass. No deployment or email send was performed.

Manual sharing is the only delivery implemented; availability explicitly returns emailDelivery:false even if account email is configured. This avoids a false sent state. Email dispatch/retry delivery owner, recipient acceptance UI/deep-link route, public legacy preview wire contracts, bulk email issuance, invitation role editing and inherited REST routes remain separate work. Explicit native policies differ from legacy raw JWT behavior: seven-day expiry, verified-email requirement, issuer reauthorization and preservation of active member roles. Full invitation parity is not claimed by this backend checkpoint.
