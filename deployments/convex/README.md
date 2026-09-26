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

### Verified state, 2026-09-26 UTC

- Project `Summoncore`, compose `k-XQ3e6x7WD32Dfl46Alu`, service `summoncore-convex-jp8som`.
- Backend container `da5a745a276b` is running and healthy. Docker config resolves the pinned backend digest to image `sha256:d6ac96d2f65c2e81f267717cd471fb773af53ecf21463ff434b89c5c1cd821d6`.
- Dashboard container `e4b20c0b856e` is running.
- Public access is **not verified**: temporary nip.io/sslip.io names resolve to the provider's blocked host at `64.176.22.9`, instead of the intended `72.60.78.94`. Certificate validation consequently fails. No credentials were sent through that endpoint.
- Requested owned DNS names: `convex-core.withsummon.com`, `convex-site.withsummon.com`, `convex-dashboard.withsummon.com`, all pointing to `72.60.78.94`. Dokploy has no connected DNS provider; these records and the corresponding domain/origin update remain pending.
- Local functions and password authentication work. Remote application functions have not yet been deployed, and existing Django/Postgres services remain intact.

Sources: [Convex self-hosting](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md), [Convex Auth manual setup](https://labs.convex.dev/auth/setup/manual).
