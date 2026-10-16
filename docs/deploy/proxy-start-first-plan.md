# Plan: zero-downtime proxy deploys (start-first)

**Status:** in progress (2026-10-16). Step 1 is this PR.
**Goal:** changing the proxy (its Caddyfile, hostnames or image) starts the new Caddy, waits until it is healthy, moves traffic to it, and only then stops the old one. Same mechanism as the api: [api-start-first-plan.md](api-start-first-plan.md).

## Why the proxy drops requests today

The proxy is the compose service `proxy`. Any change to its environment or `CADDYFILE_REVISION` recreates it, and compose stops the old container first. Measured at the origin: about 10 s of 502, then about 5 s of 404 on every path.

- **The 502s** are Traefik dialing a container that is gone.
- **The 404s** come from how Dokploy routes a compose domain. It writes Traefik labels on the `proxy` container, and Traefik's Docker provider drops the router when that container stops. Until the new container is up, no router matches `core.withsummon.com`.

Cloudflare's tunnel (`cloudflared`, #23) reaches the same container as `http://proxy:80`, so it sees the same gap.

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

**The upstreams.** The Swarm proxy can only use overlay networks, so every upstream joins `summon-core-internal` under the alias the Caddyfile already uses: `summon-core-web`, `-admin`, `-space`, `-live`, `-minio`, `-mcp`, `-ai`. The api is `summon-core-api-next`. `cloudflared` joins it too, to reach `proxy`.

## Cutover

1. **Merge the prerequisites PR** (this one: the Dockerfile, the upstream aliases on `summon-core-internal`, `cloudflared` on it). No behaviour change. The deploy recreates web, admin, space, live, minio, mcp, ai and cloudflared once to join the network.
2. **Create the Application** with the settings above, no domain yet, and deploy it. From a container on `summon-core-internal`, `curl http://proxy/` and `curl http://proxy/api/instances/` should return 200. `cloudflared` now has two `proxy`s, the compose one on `default` and the Swarm one on `summon-core-internal`; both serve the same upstreams.
3. **Move the domain.** Add `core.withsummon.com` to the Application. Traefik now has two routers for the host (the compose labels and the Application's file route), both pointing at a working proxy. Then delete the compose domain.
4. **Remove the compose `proxy` service** (PR). `cloudflared` then reaches only the Swarm proxy.
5. **Prove it:** push a no-op change under `apps/proxy`, run the origin probe through the deploy, and expect 0 non-200 responses.

**Rollback** before step 4: delete the Application's domain; the compose proxy still serves. After step 4: revert the step-4 PR and put the domain back on the compose app.

## Origin probe

`/` every 0.5 s and `/api/instances/` every 2 s (the api throttles anonymous calls at 30/minute per IP):

```bash
curl -sk -o /dev/null -w '%{http_code}' --resolve core.withsummon.com:443:72.60.78.94 https://core.withsummon.com/
```
