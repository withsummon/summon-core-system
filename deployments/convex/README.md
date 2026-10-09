# Self-hosted Convex

Both compose files pin the backend and dashboard by immutable image digest. The backend stores its database, files, and generated instance credentials in the `data` volume. Back up that volume before upgrades; do not use `down --volumes` for routine restarts.

## Local

Create a gitignored `.env.local` in this directory with `INSTANCE_NAME`, a cryptographically random `INSTANCE_SECRET`, and separate random `DOCUMENT_WORKER_TOKEN` and `TRANSCRIPTION_API_KEY` values of at least 32 characters. Restrict its permissions to the current user. Start with:

```sh
docker compose --env-file deployments/convex/.env.local -p summon-convex -f deployments/convex/compose.yml up -d
```

The API, actions, and dashboard bind only to loopback at ports 3210, 3211, and 6791. Obtain the existing admin key with the backend's `generate_admin_key.sh` and save it in a restricted, ignored `apps/convex/.env.local` as `CONVEX_SELF_HOSTED_ADMIN_KEY`, with `CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210`. Never commit or paste that key into reports.

The native Better Auth candidate requires `SUMMON_AUTH_ENGINE=better-auth`, `BETTER_AUTH_SECRET`, `CONVEX_SITE_URL` and `SITE_URL` in the function environment. Set the same engine in the CLI environment before deployment. Use a random secret and the actual site/frontend origins. Configure verified Resend delivery with `AUTH_RESEND_KEY` and `EMAIL_FROM`; enabling an email form does not establish delivery. The old Convex Auth issuer remains only for the documented [credential migration and rollback boundary](../../docs/migrations/convex/better-auth-candidate.md). Function deployment uses the native workspace typecheck, followed by the Convex bundler with its own legacy typechecker disabled.

Set function environment values from a restricted ignored file using `convex env set --from-file`. For document extraction and export, set `SUMMON_DOCUMENT_WORKER_URL=http://document-worker:8092` and the same `DOCUMENT_WORKER_TOKEN` supplied to Compose. The worker imports the shared renderer and extractor, builds from the repository root, and exposes no host port. It runs without Django or Postgres. Keep the backend and worker on their private Compose network. Validate a real authenticated upload, extraction, export and permission revocation after deploying both services.

Assistant and Automation share the existing OpenAI-compatible provider owner. OpenRouter uses `LLM_PROVIDER=openai_compatible`, `LLM_BASE_URL=https://openrouter.ai/api/v1`, `LLM_MODEL` set to an available model slug, and a server-only `LLM_API_KEY`. Both Compose files build the existing transcription worker on their private network. Set function `TRANSCRIPTION_ORIGIN=http://transcription:8091` and the same `TRANSCRIPTION_API_KEY` supplied to Compose; Docker environment alone does not configure Convex functions. The named `transcription_data` volume owns SQLite jobs, recordings and cancellation intent. Back it up with the backend volume. Preserve any existing worker’s mount when adopting it; never replace retained jobs with an empty volume or share SQLite storage between worker instances. Validate real audio, cancellation and restart recovery; health alone does not prove decoding. Both Compose files build `document-live` from the existing live-server Dockerfile and run its default native package entry against the private API and HTTP-site endpoints. Local Web builds use `VITE_CONVEX_LIVE_URL=ws://localhost:3235`; Dokploy requires an authenticated WebSocket ingress to `document-live` port 1235 and the matching `wss://` frontend build value. The service validates the existing user token and current document permissions. Audio, collaboration and provider journeys require separate runtime and browser acceptance.

## Dokploy

Use `dokploy.yml` as a raw compose service and set its two HTTPS origins. Configure three HTTPS domains in Dokploy: API to backend port 3210; actions to backend port 3210 with Internal Path `/http`; dashboard to port 6791. Keep the actions public Path `/` and Strip Path disabled. See [site ingress](site-ingress.md) before changing an existing deployment: the site cutover and its separate runtime/browser acceptance gates are recorded there. No host port is exposed. Dokploy supplies Traefik routing. The backend securely generates and persists its instance credentials on first startup when the two optional instance variables are omitted.

The explicit `10.77.2.0/28` default network addresses this host's exhausted automatic Docker address pools. It must be checked against the target host's network inventory before deployment elsewhere.

Current route and operational acceptance is tracked in the [retirement checklist](../../docs/migrations/convex/current-parity-checklist.md); dated deployments and restore trials are historical receipts in that directory. The setup above does not prove frontend cutover or authorize Django retirement.

Sources: [Convex self-hosting](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md), [Convex Better Auth](https://labs.convex.dev/better-auth), [OpenRouter API](https://openrouter.ai/docs/quickstart).
