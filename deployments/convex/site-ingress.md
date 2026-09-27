# Convex actions ingress

Status: applied to the existing remote domain on 2026-09-27 at 13:37 UTC; routing/HTTP checks passed, authenticated browser acceptance remains a separate gate. `site-domain.json` records the intended fields of the existing Dokploy domain, not a complete API update payload and not a second router.

## Owner and invariant

Dokploy v0.30.7 owns the compose domain record and generates Traefik Docker labels on redeployment. Read-only browser inspection on 2026-09-27 confirmed compose `k-XQ3e6x7WD32Dfl46Alu`, service `summoncore-convex-jp8som`, site host `convex-site.withsummon.com`, service `backend`, public Path `/`, Internal Path `/`, Strip Path disabled, container port `3211`, HTTPS with Let's Encrypt, and no listed custom middleware. The Traefik file browser has no compose-specific file. Do not add a competing file router or hand-edit generated labels.

The durable change belongs to that same domain record: **Internal Path `/http`, container port `3210`**. Preserve all other current fields, including any middleware added since inspection. The API and dashboard domain records are unchanged.

[Dokploy's pinned compose generator](https://github.com/Dokploy/dokploy/blob/v0.30.7/packages/server/src/utils/docker/domain.ts) writes `loadbalancer.server.port` from the domain port and creates an `addprefix` middleware from Internal Path. It attaches that middleware to the HTTPS application router, preserving the HTTP-to-HTTPS redirect. [Dokploy documentation](https://docs.dokploy.com/docs/core/domains) describes this path transformation; [Traefik AddPrefix](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/addprefix) supplies the native middleware.

## Route and authorization equivalence

For pinned Convex source `0cf49cbf8c4b7e22e631ceda9b5111f6cccbcd49`, `local_backend/config.rs` forwards the built-in site proxy to `http://127.0.0.1:{port}/http`; `local_backend/router.rs` mounts the HTTP action router under `/http/`. Routing site traffic to backend3210 with that prefix reaches the same action owner while bypassing the development proxy's four-slot semaphore. See the [diagnosis receipt](../../docs/migrations/convex/local-jwt-site-proxy.md).

| Public request                      | Backend request                          |
| ----------------------------------- | ---------------------------------------- |
| `/.well-known/openid-configuration` | `/http/.well-known/openid-configuration` |
| `/.well-known/jwks.json`            | `/http/.well-known/jwks.json`            |
| `/assets/<id>?workspace=<id>`       | `/http/assets/<id>?workspace=<id>`       |

The public host, TLS, `CONVEX_SITE_ORIGIN`, Convex Auth issuer, audience, signing keys and application URLs stay unchanged. The prefix is removed by the mounted router before application path matching. Authorization headers and query strings pass through; no Traefik CORS/auth/cache middleware is added. Existing asset HTTP actions still check the live session and canonical asset ACL, return their existing CORS headers, and mark bytes private/no-store. Existing upload tickets continue using their canonical storage URL. This is an ingress change, not a token producer migration.

## Activation and rollback plan

1. Obtain explicit deployment authorization and capture the current domain record plus generated site labels. Compare with the read-only values above; retain unrelated middleware and TLS settings. The remote upload-timeout investigation is separate and is not fixed by this routing change.
2. Edit the existing site domain's Internal Path to `/http` and Port to `3210`. Do not change Public Path, Strip Path, hostname, origins or credentials. Dokploy says compose domain changes require redeployment; use its normal redeploy operation only in the approved window. No restart was performed for this proposal.
3. Verify the served generated labels contain one AddPrefix `/http` on the site HTTPS router and site service port3210. Check discovery/JWKS over the unchanged public host, fresh sign-in, authenticated asset GET plus OPTIONS, foreign-access rejection and current-session revocation. Test a small concurrent authenticated image burst with exact byte hashes. Record the deployed image/source identity, URLs, response evidence and Chrome dynamic replacement/restore without reload.
4. Roll back through the same domain owner to its captured Internal Path `/` and Port3211 if route/auth behavior differs. Redeploy and verify discovery/sign-in. This rollback restores the known proxy limitation; it does not establish the original configuration as safe under concurrent authenticated asset load.

## Local proof and diagnostic gateway lifecycle

The local proof uses a temporary loopback-only Node gateway on3218 forwarding to3210 `/http`, with JWT issuer remaining3211. Production frontend3028 targets3218. Eight synthetic authenticated reads returned matching bytes; eight unauthorized reads were denied. Chrome fresh sign-in and dynamic avatar restore rendered192×192 without reload. These are bounded correctness observations, not capacity measurements or a remote rollout.

The gateway is `/tmp/summon-migration-control/site-gateway-probe.mjs`, started in agent exec session33522. It has no credentials or persistent service registration. Keep it running while the3028 acceptance artifact depends on it. Do not silently turn it into the production ingress or kill it while that artifact is in use. After acceptance users are moved to a durable approved ingress, stop that owned session with SIGINT, verify the3218 listener is gone, and retire the artifact's advertised URL or rebuild it for the durable actions origin. Do not use a broad process kill.

A durable local environment can use the same existing Traefik domain mechanism when a local Traefik owner is configured; the current local compose has none. Installing a new proxy service or changing the local issuer is outside this prepared change. Until an approved local ingress is configured,3218 remains an explicitly temporary diagnostic dependency, and direct3211 asset load can reproduce the original issue.

## Remote activation receipt

Configuration commit `b908ada2e4` was applied through the existing Dokploy domain editor, changing only Internal Path and Port. Normal Deploy completed in six seconds. Logs show the backend recreated and healthy; the existing dashboard remained running. No Fresh Volumes/Rebuild action, terminal, credential change or origin change was used.

Running container `6fb2a9197156a920239a881ce6f2e5f3cfbf0553cac30b149b0fe6597cd94470` started at `2026-09-27T13:37:21.985760587Z`. Its read-only Container Config image field is `ghcr.io/get-convex/convex-backend@sha256:b756b06641d15a55b5ec0692897ce5ad3715ddccfd02e1e213621e9e764255c8`. Running labels—not only Preview Compose—confirm site router129 uses AddPrefix `/http`, both site services target3210, HTTPS retains `letsencrypt`, and HTTP retains `redirect-to-https@file`. API router128 remains3210.

Ordinary HTTPS verification after deployment: discovery200 with unchanged issuer `https://convex-site.withsummon.com` and same-host JWKS URI; JWKS200 with one public key; `/assets/invalid` OPTIONS204 with existing `Authorization`, `GET, OPTIONS`, `*` CORS headers; anonymous GET401 and invalid-Bearer GET401, both `Authentication required.`. Certificate verification remained enabled. Sanitized raw receipt: `/tmp/summon-migration-control/site-ingress-remote-http.json`. Authenticated asset byte/ACL and browser acceptance are not claimed by these negative checks. This deployment changes container ingress only; it does not establish a new Convex function checkpoint or resolve the independent remote function-upload issue.

Root Chrome acceptance after redeployment: the existing authenticated session in immutable frontend3024 (source `82f2f63`) recovered on reload and rendered existing task RQA2. Downloading `summon-draft-attachment-qa.txt` produced an OPTIONS204 followed by authenticated GET200 (`text/plain`) from `https://convex-site.withsummon.com/assets/j577d3b76jmpy9m5dst2xtvbb58f6gnm`; the button returned to its enabled state without error. No task mutation was performed. This verifies existing-session recovery and an authenticated download through the changed ingress; it does not establish fresh credential login, concurrent remote downloads or session-revocation acceptance.
