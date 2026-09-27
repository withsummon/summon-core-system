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

Use `dokploy.yml` as a raw compose service and set its two HTTPS origins. Configure three HTTPS domains in Dokploy: API to backend port 3210; actions to backend port 3210 with Internal Path `/http`; dashboard to port 6791. Keep the actions public Path `/` and Strip Path disabled. See [site ingress](site-ingress.md) before changing an existing deployment: the site cutover and its separate runtime/browser acceptance gates are recorded there. No host port is exposed. Dokploy supplies Traefik routing. The backend securely generates and persists its instance credentials on first startup when the two optional instance variables are omitted.

The explicit `10.77.2.0/28` default network addresses this host's exhausted automatic Docker address pools. It must be checked against the target host's network inventory before deployment elsewhere.

Current route and operational acceptance is tracked in the [retirement checklist](../../docs/migrations/convex/current-parity-checklist.md); dated deployments and restore trials are historical receipts in that directory. The setup above does not prove frontend cutover or authorize Django retirement.

Sources: [Convex self-hosting](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md), [Convex Auth manual setup](https://labs.convex.dev/auth/setup/manual).
