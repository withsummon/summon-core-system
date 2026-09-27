# Native JWT verification avoids the site proxy self-dependency

## Observed failure

Avatar replacement/restoration mutations completed, while the authenticated image GET remained pending. Reload could recover. Docker access logs showed asset GET durations around 63 seconds and canceled GETs lasting 44–71 seconds. Unauthenticated `http://127.0.0.1:3211/.well-known/jwks.json` timed out in both host and container probes; direct `http://127.0.0.1:3210/http/.well-known/jwks.json` returned 200 in 19 ms. A separate unloaded restore-proof site listener responded in 50 ms. This was below the React image effect and did not justify a frontend timer/retry/fallback.

## Pinned production owner

Local image digest `sha256:b756b06641d15a55b5ec0692897ce5ad3715ddccfd02e1e213621e9e764255c8` identifies source revision `0cf49cbf8c4b7e22e631ceda9b5111f6cccbcd49`.

- [Site proxy](https://github.com/get-convex/convex-backend/blob/0cf49cbf8c4b7e22e631ceda9b5111f6cccbcd49/crates/local_backend/src/proxy.rs) passes a hardcoded concurrency of four to its HTTP service.
- [HTTP service](https://github.com/get-convex/convex-backend/blob/0cf49cbf8c4b7e22e631ceda9b5111f6cccbcd49/crates/common/src/http/mod.rs) implements this with a semaphore and global concurrency limiter.
- [HTTP action entry](https://github.com/get-convex/convex-backend/blob/0cf49cbf8c4b7e22e631ceda9b5111f6cccbcd49/crates/local_backend/src/http_actions.rs) extracts identity before the action body. Authenticated requests can occupy the site proxy while discovery/JWKS requests need that same listener.
- [JWT verification](https://github.com/get-convex/convex-backend/blob/0cf49cbf8c4b7e22e631ceda9b5111f6cccbcd49/crates/authentication/src/lib.rs) supports locally decoded data URI JWKS. [Official configuration](https://docs.convex.dev/auth/advanced/custom-jwt) documents this option.

## Fix and rotation boundary

The native auth config uses a custom JWT provider with the existing public `JWKS` environment value embedded as a data URI. Issuer stays `CONVEX_SITE_URL`, audience stays `convex`, algorithm stays RS256, matching the installed Convex Auth token producer. No private key is copied into configuration. The existing local public set was inspected for count/private field absence only: one key, no private RSA fields.

This removes network discovery from verification. It does not change JWT signatures, session-revocation checks, asset ACLs, origins, worker limits or timeouts. No backend restart or remote change is included.

The public verification set is captured at deployment. Key rotation must update the public JWKS and redeploy auth configuration in coordination with the signing key; merely changing the JWKS environment value does not replace an already deployed config. Three focused tests verify exact provider shape, immutable prior configuration during rotation, and rejection of missing deployment inputs. Native TypeScript passes. Live recovery and browser mutation acceptance follow deployment.
