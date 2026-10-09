# Native JWT verification avoids the site proxy self-dependency

## Observed failure

Avatar replacement/restoration mutations completed, while the authenticated image GET remained pending. Reload could recover. Docker access logs showed asset GET durations around 63 seconds and canceled GETs lasting 44–71 seconds. Unauthenticated `http://127.0.0.1:3211/.well-known/jwks.json` timed out in both host and container probes; direct `http://127.0.0.1:3210/http/.well-known/jwks.json` returned 200 in 19 ms. A separate unloaded restore-proof site listener responded in 50 ms. This was below the React image effect and did not justify a frontend timer/retry/fallback.

## Pinned production owner

Local image digest `sha256:b756b06641d15a55b5ec0692897ce5ad3715ddccfd02e1e213621e9e764255c8` identifies source revision `0cf49cbf8c4b7e22e631ceda9b5111f6cccbcd49`.

- [Site proxy](https://github.com/get-convex/convex-backend/blob/0cf49cbf8c4b7e22e631ceda9b5111f6cccbcd49/crates/local_backend/src/proxy.rs) passes a hardcoded concurrency of four to its HTTP service.
- [HTTP service](https://github.com/get-convex/convex-backend/blob/0cf49cbf8c4b7e22e631ceda9b5111f6cccbcd49/crates/common/src/http/mod.rs) implements this with a semaphore and global concurrency limiter.
- [HTTP action entry](https://github.com/get-convex/convex-backend/blob/0cf49cbf8c4b7e22e631ceda9b5111f6cccbcd49/crates/local_backend/src/http_actions.rs) extracts identity before the action body. Authenticated requests can occupy the site proxy while discovery/JWKS requests need that same listener.
- [JWT verification](https://github.com/get-convex/convex-backend/blob/0cf49cbf8c4b7e22e631ceda9b5111f6cccbcd49/crates/authentication/src/lib.rs) supports locally decoded data URI JWKS. [Official configuration](https://docs.convex.dev/auth/advanced/custom-jwt) documents this option.

## Rejected workaround and restored auth owner

Commit `168a441677` attempted custom JWT verification with inline public JWKS while retaining issuer/audience/RS256. Configuration tests passed, but real sign-in failed: the pinned custom JWT decoder requires a `kid` header, while the existing Convex Auth producer signs only `alg: RS256`. This incompatibility was not caught by provider-shape tests. Commit `51cd46a788` restored the original OIDC provider and deployed locally. The unused experimental config helper and tests are removed. Existing token production, signatures, issuer and audience remain unchanged.

## Routing diagnostic proof

A temporary dependency-free Node HTTP gateway bound only to `127.0.0.1:3218` forwards paths to `127.0.0.1:3210/http`. Pinned `config.rs:193` uses that exact forward prefix for the built-in site proxy, and `router.rs:417` mounts the same authenticated HTTP action router there. The gateway bypasses only the development proxy's four-slot admission limit. It does not alter credentials, origin, JWT issuer, session checks or asset authorization.

After all agent-owned local frontend clients were drained, the original site JWKS responded in 21.6 ms and canonical refresh succeeded. An isolated benchmark account with no avatar uploaded `workspace-logo-qa.png` through native prepare/upload/finalize. Eight concurrent authenticated gateway reads all returned 200, 3,071 bytes and exact SHA256 matches (28–31 ms). The synthetic avatar was then removed through recoverable profile lifecycle. Eight attempts by that account to read a different owner's avatar all returned 403. This is a bounded routing diagnosis, not production capacity evidence.

Raw evidence: `/tmp/summon-migration-control/site-gateway-positive.jsonl`; gateway source `site-gateway-probe.mjs` in the same directory. Parent Chrome acceptance uses a production artifact configured for site gateway3218. Remote routing remains unchanged pending a reviewed ingress plan. No backend restart was performed.

A diagnostic process-command inspection accidentally exposed the local instance secret in tool output. It was not sent externally or committed. Later inspection was field-filtered; credential rotation remains an explicit operational follow-up rather than being performed silently.
