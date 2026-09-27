# Account email change (D09 bounded backend)

## Inherited contract and owner

`app/urls/user.py` registers POST `users/me/email/generate-code/` and PATCH
`users/me/email/`. `app/views/user/base.py` validates a different normalized
address, checks collisions, issues a six-digit ten-minute code, limits issuance
to three per hour with a one-minute cooldown, then changes the same user and
logs out. The deployed change-email modal is the production consumer; it is not
rewired by this backend slice.

The native owner is `identity/emailChange`. Public request/confirm actions reuse
current-account proof (exact verified password hash, or an actual session created
within five minutes for accounts without a password). Internal mutations repeat
live-session and proof checks. One challenge per user binds old/new addresses,
session and nonce; only its digest is stored. Resend replaces the challenge,
failure invalidates it, and five incorrect attempts lock it. Cooldown and hourly
quota survive delivery failure. No challenge data is publicly queried.

Confirmation rechecks both users.email and email-addressed password/magic account
collisions in the same transaction as identity updates. It preserves user ID,
password hash and OAuth subject/claim, renames password/magic account identifiers,
removes outstanding account verification codes and revokes every own session and
refresh token. Cleanup budgets fail atomically before writes (100 accounts,
100 sessions, 1,000 refresh tokens, 100 verification codes / ten per account).
A successful address challenge intentionally establishes email verification;
legacy instead cleared its verification flag. There is no inferred verification.

## Canonical authentication callback

Pinned Convex Auth 0.0.95 `implementation/users.ts` normally patches the user with
every existing OAuth profile, which would undo a local email change. The supported
`createOrUpdateUser` callback now preserves the established account's user and
local address. Same-address verified claims can refresh verification. New
accounts retain verified-address linking (including package-requested password
verification linking), reject ambiguous verified identities, and use only current
provider profile fields. No arbitrary OAuth subject reassignment is introduced.
Restricted identities cannot be refreshed or linked. Password email spelling
remains the installed Password provider's existing contract; the change flow
normalizes its new address as inherited.

## Evidence and remaining boundary

Scoped behavioral tests cover session-bound proofs, stale password hash, late user
and account collisions, persisted bad-code attempts, expiry, resend and hourly
limits, atomic account/session/code consequences, mocked Resend request/confirm
and delivery failure. Installed auth.store OAuth tests prove an old provider email
cannot rename the changed user or merge it with another old-address owner. Existing
mail reset/magic/verification tests exercise the shared sender and callback.

No real email, credential change, deployment or production UI activation was
performed. Old/new address notifications are scheduled atomically only after a successful
change, with durable status, three bounded delivery attempts and stable Resend
idempotency keys. They contain no challenge code or replacement address. Failed
jobs remain visible to operator database inspection; no public retry control is
provided. A scheduled action terminated between get/send/record can remain pending:
scheduled actions are at most once, and this slice has no lease/cron recovery.
Stored status supports operator inspection but does not guarantee eventual
delivery. Stable Resend idempotency keys limit duplicate delivery during the
provider retention window. Browser UI and real configured delivery remain
unverified. Instance email-discovery semantics
and arbitrary external provider linking are outside this slice.

## Owner review gates

The identity suite passed 80 tests across 19 files, including installed password
signup before/after verification and email-provider first registration. Native
TS7 passed. Touched Oxc and format checks passed. Classic cyclomatic complexity
is 14 for the canonical user callback, 14 for begin and 13 for commit (maximum
14 across the changed owners). Cognitive review: Clear. The commit reads in
proof → challenge → collision → bounded cleanup → atomic update/notification
order; extracted sender is used by both existing authentication mail and this
flow. No alternate account store, credential hash implementation or REST adapter
was added. Generated bindings expose the canonical action/query contracts.
