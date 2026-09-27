# Self-hosted Convex

Both compose files pin the backend and dashboard by immutable image digest. The backend stores its database, files, and generated instance credentials in the `data` volume. Back up that volume before upgrades; do not use `down --volumes` for routine restarts.

## Local

Create a gitignored `.env.local` in this directory with `INSTANCE_NAME` and a cryptographically random `INSTANCE_SECRET`. Restrict its permissions to the current user. Start with:

```sh
docker compose --env-file deployments/convex/.env.local -p summon-convex -f deployments/convex/compose.yml up -d
```

The API, actions, and dashboard bind only to loopback at ports 3210, 3211, and 6791. Obtain the existing admin key with the backend's `generate_admin_key.sh` and save it in a restricted, ignored `apps/convex/.env.local` as `CONVEX_SELF_HOSTED_ADMIN_KEY`, with `CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210`. Never commit or paste that key into reports.

Convex Auth additionally requires `JWT_PRIVATE_KEY`, `JWKS`, and `SITE_URL` in the backend environment. Use the documented Convex Auth key generation procedure, then `convex env set --from-file` from a restricted ignored file. Function deployment uses the native workspace typecheck, followed by the Convex bundler with its own legacy typechecker disabled.

## Dokploy

Use `dokploy.yml` as a raw compose service and set its two HTTPS origins. Configure three HTTPS domains in Dokploy: backend port 3210, backend port 3211, and dashboard port 6791. No host port is exposed. Dokploy supplies Traefik routing. The backend securely generates and persists its instance credentials on first startup when the two optional instance variables are omitted.

The explicit `10.77.2.0/28` default network addresses this host's exhausted automatic Docker address pools. It must be checked against the target host's network inventory before deployment elsewhere.

### Verified state, 2026-09-27

- Project `Summoncore`, compose `k-XQ3e6x7WD32Dfl46Alu`, service `summoncore-convex-jp8som`.
- DNS-only A records for `convex-core.withsummon.com`, `convex-site.withsummon.com`, and `convex-dashboard.withsummon.com` resolve to `72.60.78.94`. Dokploy routes their HTTPS traffic to backend ports 3210/3211 and dashboard port 6791 respectively. Certificate hostname validation passed for all three domains without bypasses.
- Backend container `849de119830f` is healthy, using image `sha256:d6ac96d2f65c2e81f267717cd471fb773af53ecf21463ff434b89c5c1cd821d6`. Dashboard container `728b8855cd4a` is running. Runtime backend configuration confirms the owned API/actions origins. The remote compose previously hardcoded temporary origins; it now uses the same environment substitutions as `dokploy.yml`.
- Committed function snapshot `7dbec1f512d594116e9efb8d276b1495c72bf7df` deployed successfully from a separate source archive. Intake work in progress was excluded. Schema validation and index creation completed.
- Independent remote authentication keys were configured through the CLI. HTTPS runtime verification passed password sign-up, authenticated identity lookup, workspace creation, and workspace list readback using a synthetic account. Credentials and tokens remain in mode-600 local temporary files, outside Git.
- `SITE_URL` currently points to `http://127.0.0.1:3016` for planned local-browser remote-backend QA. This is not a public application frontend deployment. Browser authentication/realtime workflows on this remote backend remain unverified.
- Existing Django/Postgres services remain intact. This checkpoint does not establish inherited-feature parity or authorize retirement.

Sources: [Convex self-hosting](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md), [Convex Auth manual setup](https://labs.convex.dev/auth/setup/manual).

### Application checkpoint 903cee2124

Committed functions `903cee21243acfacb92950ef7615b55513d80a84` deployed to the remote backend with schema/index validation. A production web bundle served locally at `http://127.0.0.1:3016/core` targets the owned remote API/actions domains. Chrome verified synthetic sign-up, workspace/project/task creation and a second tab receiving the task without reload; no browser errors were captured. The served index hash matched the recorded build artifact. See `docs/migrations/convex/checkpoints/903cee2124-remote.json` for exact hashes and the dependency-state limitation. This is local frontend plus remote backend verification, not public frontend rollout or full Plane parity.
