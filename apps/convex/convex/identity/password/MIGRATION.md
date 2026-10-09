# Current-account password changes

The inherited owners are ChangePasswordEndpoint and SetUserPasswordEndpoint in `authentication/views/common.py`. They require the current password for an existing credential, allow an initial password for an autoset account, and use Python zxcvbn score3. Native wrappers use the current live identity and installed Convex Auth Password crypto/account owners. No custom password hash, credential store or client-supplied account ID is introduced.

## Atomic boundary

The pinned auth patch adds optional server-only session guards to public modifyAccountCredentials/createAccount helpers and their canonical mutations. Existing reset/signup callers keep their existing behavior. The current-account wrappers always supply the guard and reject unsafe secret/debug logging before package calls.

Change verifies the old password via retrieveAccount, captures the exact returned account hash, and submits that hash together with its actor/session/account IDs. The mutation rechecks the live token subject, session existence/expiry/actor, account owner and unchanged hash before hashing/writing the new credential. It never rereads a newer hash after verification. An intervening reset/change or session revocation aborts the write. Set requires a current uniquely verified email, no existing Password account or global account-ID collision, and uses canonical upsert; the returned owner must match the bound actor. The resulting account retains the current email verification proof.

Both mutations revoke other sessions and their refresh chains in the same transaction, retaining the current session. Cleanup preflight is bounded to100 user sessions and1000 aggregate other-session refresh rows; exceeding either returns an explicit failure before any credential change. Existing deleteSession owns deletion. Native requireUser session enforcement immediately blocks revoked sessions. No preflight-only action authorization is relied upon for the commit.

## Policy and evidence

One native password policy callback now owns signup/reset/change/set bounds:8–1024 characters. The inherited Python zxcvbn4.4.28 dependency exists only in API requirements; inspected JS manifests/catalog/lock contain no equivalent dependency. Exact zxcvbn score parity remains open and is not replaced by an invented strength score. No dependency was added.

Seven module-local BDD run through installed patched runtime: wrong-current-password denial; correct change and old/new credential verification; retained current session and other refresh-chain removal; an exact verified-hash interleaving followed by peer password change; revoked/expired/foreign session and wrong provider denial; verified initial setup and collision/ambiguity denial; unsafe logging denial; and session/token budget rollback. Eight mail tests also pass with the preserved earlier patch. No real credential was changed and no actual mail/provider request was sent.

The public app boundary returns only capabilities or mutation completion. Passwords, hashes, account lookup keys and session guard payloads are not exposed in query results. The internal account query returns no hash. The account form is mounted after deployment of exact backend checkpoint b3725c3e11 to both local and remote hosts; it captures change/set mode when opened, uses password inputs and explicit confirmation, and reports other-session revocation. Production credential mutation in Chrome remains a user handoff, not an automated acceptance step.

## Patch maintenance

Source, runtime JS and public/internal declarations are included in the exact0.0.95 package patch. Native TS7 emitted the changed declarations; runtime transpilation uses explicit type-only imports, tested through the installed package. Preserve prior reset anti-enumeration and issuance throttling hunks. Remove these guards only after an upstream public API provides and passes equivalent atomic live-session, credential-CAS and revocation tests. Existing library license is unchanged. Full standalone package TS compilation has inherited dependency/global/typed-array diagnostics; app TS7 and actual runtime tests are the acceptance gates, not a claim that upstream source builds cleanly under our ad-hoc compiler options.

Final installed-patch gate:465 backend tests across70files, backend and web TS7, focused Oxc pass. Highest touched application complexity8; patched account mutation12, shared session/setup guards10, guarded modify11 (Oxlint classic). Generated patch context lines contain required space-prefixed blank lines, so the patch path has Git whitespace checks disabled; application-source whitespace checks remain enabled. The package-manager frozen install gate passes.

Deployment receipt: immutable git archive b3725c3e11, local http://127.0.0.1:3210 and remote https://convex-core.withsummon.com. Both public capabilities endpoints returned canonical SESSION_EXPIRED to anonymous requests, confirming live function presence without modifying credentials. CLI logs are password-b3725c3e11-{local,remote}-deploy.txt in the task control directory. Account details → Manage password mounts the capability query/form; web TS7 and focused Oxc pass. Parent owns rendered narrow/desktop inspection; no successful real credential mutation is claimed.

Primary Chrome visual-only acceptance: Account details → Manage password → Change password displayed all three password labels and the session notice; fields/actions were scroll-reachable in the narrow sidebar and buttons wrapped. Cancel closed the form. No credentials were entered or changed.
