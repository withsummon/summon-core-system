# Plan: zero-downtime proxy deploys (start-first)

**Status:** live (2026-10-16). The proxy runs as the Dokploy Application `proxy (swarm)` (`summon-core-proxy-swarm-363qxm`, applicationId `CDIOZXp7_jDZRTxV-UiSD`) in Summoncore / production; compose no longer has a proxy service.
**Goal:** changing the proxy (its Caddyfile, hostnames or image) starts the new Caddy, waits until it is healthy, moves traffic to it, and only then stops the old one. Same mechanism as the api: [api-start-first-plan.md](api-start-first-plan.md).

## Why the proxy dropped requests

The proxy was the compose service `proxy`. Any change to its environment or `CADDYFILE_REVISION` recreated it, and compose stopped the old container first. Measured at the origin: about 10 s of 502, then about 5 s of 404 on every path.

- **The 502s** were Traefik dialing a container that was gone.
- **The 404s** came from how Dokploy routes a compose domain. It writes Traefik labels on the `proxy` container, and Traefik's Docker provider drops the router when that container stops. Until the new container was up, no router matched `core.withsummon.com`.

Cloudflare's tunnel (`cloudflared`, #23) reached the same container as `http://proxy:80`, so it saw the same gap.

## Options

| Option                                 | Verdict                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reload Caddy in place (`caddy reload`) | Rejected. Dokploy has no post-deploy hook for compose, so nothing would run the reload. A changed env var or image still recreates the container, and the label router still disappears with it.                                                                                                                                                    |
| **Swarm Application, start-first**     | **Chosen.** Dokploy routes an Application's domain through a Traefik file route to the service name, which resolves to the service's virtual IP. That route and that IP stay put while Swarm swaps tasks behind it, so neither the 404 nor the 502 phase exists. It is the pattern the api already proved (671 requests, 0 errors across a deploy). |

## The Application

`apps/proxy/Dockerfile.swarm` holds the whole proxy configuration: the upstream image, the Caddyfile, the hostnames and the health check. Anything that changes the proxy is a new image, and every new image rolls out start-first. `CADDYFILE_REVISION` goes away.

| Setting           | Value                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Name              | `proxy (swarm)` in Summoncore / production                                                                                                                   |
| Source            | this repo, branch `main`, autodeploy on                                                                                                                      |
| Watch paths       | `apps/proxy/**`                                                                                                                                              |
| Build             | Dockerfile `Dockerfile.swarm`, build path `/apps/proxy`                                                                                                      |
| Environment       | none (baked into the image)                                                                                                                                  |
| Networks          | `dokploy-network` (no alias; Traefik uses the service name) and `summon-core-internal` with alias `proxy`, set as `networkSwarm` **before the first deploy** |
| Domain            | `core.withsummon.com`, port 80, https, Let's Encrypt (moved from the compose app)                                                                            |
| Replicas          | 1                                                                                                                                                            |
| Health check      | from the image: Caddy's admin API, every 2 s, start period 20 s                                                                                              |
| Update config     | parallelism 1, delay 0, order **start-first**, failure action **rollback**, monitor 10 s, max failure ratio 0                                                |
| Rollback config   | parallelism 1, order start-first                                                                                                                             |
| Stop grace period | 30 s (open websockets and AI streams on the old task are cut after this; clients reconnect)                                                                  |
| Resources         | reserve 0.1 CPU / 64 MB, limit 1 CPU / 512 MB                                                                                                                |

**Aliases must exist at creation.** Swarm registers an alias's DNS name only when the service is created or after a stop-first update ([The api's name](api-start-first-plan.md#the-apis-name)). The alias `proxy` is what the tunnel's remotely managed route (`http://proxy:80`) dials, so it must be in `networkSwarm` before the Application's first deploy.

**The upstreams.** The Swarm proxy can only use overlay networks, so every upstream joins `summon-core-internal` under the alias the Caddyfile already uses: `summon-core-web`, `-admin`, `-space`, `-live`, `-minio`, `-mcp`, `-ai`. The api is `summon-core-api-next`. The tunnel's connectors join it too, to reach `proxy`.

## Cutover

1. **Merge the prerequisites PR** (#26: the Dockerfile, the upstream aliases on `summon-core-internal`, `cloudflared` on it). No behaviour change. The deploy recreates web, admin, space, live, minio, mcp, ai and cloudflared once to join the network. Measured: the origin answered all 341 requests with 200, while the edge returned 1×502 and 7×530 over ~8 s while cloudflared was recreated (see [The tunnel](#the-tunnel)).
2. **Create the Application** with the settings above, no domain yet, and deploy it. From a container on `summon-core-internal`, `curl http://proxy/` and `curl http://proxy/api/instances/` should return 200. `cloudflared` now has two `proxy`s, the compose one on `default` and the Swarm one on `summon-core-internal`; both serve the same upstreams.
3. **Move the domain.** Add `core.withsummon.com` to the Application. Traefik now has two routers for the host (the compose labels and the Application's file route), both pointing at a working proxy. Then delete the compose domain.
4. **Remove the compose `proxy` service** (PR). `cloudflared` then reaches only the Swarm proxy. Removing its `depends_on: proxy` does not recreate cloudflared (checked with Compose), so the tunnel stays up.
5. **Prove it:** deploy the Application (the same rebuild and start-first update a push under `apps/proxy` triggers), run the origin probe through the deploy, and expect 0 non-200 responses.

   **Result (2026-10-16 05:06 UTC):** 804 requests across the deploy, all 200: 470 origin `/`, 96 origin `/api/instances/`, and 238 through Cloudflare and the tunnel. The slowest took 1.1 s. Swarm's update ran 05:06:42–05:07:00, and the new task served before the old one stopped. Before the probe, connection counts showed Traefik and cloudflared already used only the Swarm proxy (the compose proxy had 0 connections), so the probe measured the Swarm path.

**Rollback** before step 4: delete the Application's domain; the compose proxy still serves. After step 4: revert the step-4 PR and put the domain back on the compose app.

## The tunnel

The compose `cloudflared` was the last recreate-shaped gap: one connector, so any change to it dropped the tunnel for ~8 s and Cloudflare answered 502/530 (seen on the #26 deploy). It now runs as the Dokploy Application `cloudflared (swarm)` (`summon-core-cloudflared-qqxea3`, applicationId `m4ygR2p8VsQyzs6KcxCqS`).

| Setting           | Value                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Source            | Docker image `cloudflare/cloudflared:2025.8.1` (no autodeploy; bump the tag in Dokploy and deploy)                                        |
| Args              | `tunnel --metrics 0.0.0.0:2000 run --token-file /run/secrets/cloudflare_tunnel_token` (the image entrypoint adds `--no-autoupdate`)       |
| Mount             | bind `/etc/dokploy-secrets/summon-core-plane/cloudflare_tunnel_token` → `/run/secrets/cloudflare_tunnel_token` (owned by 65532, mode 600) |
| Networks          | `summon-core-internal` only, where `proxy` is the Swarm proxy                                                                             |
| Replicas          | 2 (two connectors, 4 Cloudflare connections each)                                                                                         |
| Health check      | `cloudflared tunnel --metrics 127.0.0.1:2000 ready`, every 2 s, start period 20 s: healthy once a connection is registered                |
| Update config     | parallelism 1, delay 5 s, order **start-first**, failure action **rollback**, monitor 10 s                                                |
| Stop grace period | 40 s (cloudflared stops taking new requests on SIGTERM and drains for up to 30 s)                                                         |

Cutover: the Swarm connectors joined the same tunnel next to the compose one, so the tunnel briefly had three; a probe across that returned 778 of 778 requests with 200. Removing the compose service then left the two Swarm connectors.

**Result (2026-10-16, 05:27–05:34 UTC):** 1820 requests, all 200: 826 through Cloudflare and the tunnel (one every 0.5 s), 826 origin `/`, and 168 origin `/api/instances/`. The probe covered the compose connector's removal (#29, 61 edge requests, all 200) and a start-first update that replaced both Swarm connectors at 05:30:02–05:30:37 (90 edge requests, all 200).

## Web

`web` (the static nginx frontend) restarted stop-first as a compose service, now removed, so a web deploy left `/` waiting up to ~11 s behind Caddy's retry. It now runs as the Dokploy Application `web (swarm)` (`summon-core-web-swarm-xamugo`, applicationId `IK76m-FtyUhZ4M6pmXdpO`).

| Setting           | Value                                                                                                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source            | this repo, branch `main`, autodeploy on                                                                                                                                                |
| Watch paths       | `apps/web/**`, `packages/**`, `package.json`, `bun.lock`, `bunfig.toml`                                                                                                                |
| Build             | Dockerfile `apps/web/Dockerfile.web`, build path `/`, **docker context path `.`** (left empty, Dokploy builds from the Dockerfile's folder and `apps/web/nginx/nginx.conf` is missing) |
| Networks          | `summon-core-internal` only, alias `summon-core-web-swarm` (the proxy's `WEB_HOST`), set before the first deploy                                                                       |
| Health check      | `curl -fsS http://127.0.0.1:3000/`, every 2 s, start period 10 s (the image's own check runs every 30 s)                                                                               |
| Update config     | parallelism 1, delay 0, order **start-first**, failure action **rollback**, monitor 10 s                                                                                               |
| Stop grace period | 15 s                                                                                                                                                                                   |

**Version skew during the swap.** For the moment both tasks are behind the virtual IP, a browser can get the shell from one build and request `/assets/…` from the other. A missing asset is a plain 404, and the window lasts only from the new task passing its health check until the old one leaves the virtual IP. This is the same skew a tab already open across any deploy sees.

**Result (2026-10-16):** each step was probed at the origin and through Cloudflare:

| Step                                              | Requests | Non-200 | Slowest at origin |
| ------------------------------------------------- | -------: | ------: | ----------------: |
| #32: the proxy rolls out with `WEB_HOST` switched |     2078 |       0 |            0.76 s |
| #33: the compose web is removed                   |     1822 |       0 |            0.83 s |
| Start-first web deploy (06:14:51–06:15:10 UTC)    |     1818 |       0 |            1.36 s |

During that web deploy, 157 requests landed inside the swap window (06:14:45–06:15:20), and all returned 200. The #28 deploy under compose had held `/` for up to 11.7 s.

## ai and the Summon MCP

`ai` serves the assistant (`/ai/chat…`) and the Summon MCP (`/ai/mcp`). As a compose service it restarted stop-first on **every** push, even docs-only ones, because its image stamps the commit. Each restart paused `/ai/*` and cut in-flight replies and MCP calls. It now runs as the Dokploy Application `ai (swarm)` (`summon-core-ai-swarm-irlqgk`, applicationId `uNdAS_DE56cQl6P843E9r`).

| Setting           | Value                                                                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source            | this repo, branch `main`, autodeploy on                                                                                                             |
| Watch paths       | `apps/ai/**`, `packages/summon-contract/**`, `packages/typescript-config/**`, `package.json`, `bun.lock`, `bunfig.toml`                             |
| Build             | Dockerfile `apps/ai/Dockerfile`, build path `/`, docker context path `.`                                                                            |
| Environment       | `DJANGO_URL=http://summon-core-api-next:8000`, `WEB_URL`, `PLANE_MCP_URL=http://mcp:8211/mcp/http/api-key/mcp`, `SUMMON_AI_INTERNAL_TOKEN_FILE`     |
| Mount             | bind `/etc/dokploy-secrets/summon-core-plane/summon_ai_internal_token` → `/run/secrets/summon_ai_internal_token` (uid 1000, the image's `bun` user) |
| Networks          | `summon-core-internal` only, alias `summon-core-ai-swarm` (the proxy's `AI_HOST`)                                                                   |
| Health check      | `fetch('http://127.0.0.1:3300/ai/health')`, every 2 s, start period 20 s                                                                            |
| Update config     | parallelism 1, delay 0, order **start-first**, failure action **rollback**, monitor 10 s                                                            |
| Stop grace period | 330 s, longer than the app's 5-minute drain                                                                                                         |

- **Version stamp.** `/ai/health` reports the commit the image was built from. The Dockerfile reads it from the clone's `.git`, which `apps/ai/Dockerfile.dockerignore` lets into the build context, because an Application cannot pass a separate `git` build context.
- **Drain.** On SIGTERM the server stops accepting and gives in-flight turns and MCP calls up to 5 minutes to finish (`gracefulShutdownTimeout` in `apps/ai/src/main.ts`). Swarm has already sent new requests to the new task by then.
- **MCP sessions.** Clients on MCP protocol 2026-07-28 are stateless. Older protocols get an in-memory `Mcp-Session-Id`, which the new task does not know, so after a swap such a client gets 404 and must re-initialize, as the MCP spec requires.

## What still restarts stop-first

These compose services still restart stop-first, and Caddy's 60 s retry holds their requests while they do (no errors, but a wait):

- `live` and `mcp`, which change only with their pinned images.
- `admin` and `space`, which change only when `PLANE_RELEASE` images are pulled.

Through Cloudflare, an occasional 1–4 s request also shows up outside deploys; the origin stays under 1 s, so that is the Cloudflare and tunnel path, not the app.

## Origin probe

`/` every 0.5 s and `/api/instances/` every 2.5 s (the api throttles anonymous calls at 30/minute per IP, so run one probe at a time):

```bash
curl -sk -o /dev/null -w '%{http_code}' --resolve core.withsummon.com:443:72.60.78.94 https://core.withsummon.com/
```
