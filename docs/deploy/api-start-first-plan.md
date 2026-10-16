# Plan: zero-downtime api deploys (start-first)

**Status:** proposal (2026-10-16). The prerequisites are in the PR that adds this file; nothing has changed in Dokploy.
**Goal:** a deploy starts the new api, waits until it is healthy, moves traffic to it, and only then stops the old one. Users see no error and no wait.

## Where we are

| Deploy                           | api unreachable |                Failed requests | Evidence       |
| -------------------------------- | --------------: | -----------------------------: | -------------- |
| fcfa6bdf (before #21)            |           ~78 s |   some 502s (Caddy holds 60 s) | external probe |
| d5e76c51 (#21, one-process boot) |           ~38 s | 0 (requests waited up to 38 s) | external probe |

The remaining gap is structural. summon-core is a Dokploy **docker-compose** app, and compose always stops the old container before it starts the new one. Tested on Compose v5.5, compose ignores `deploy.update_config.order: start-first`, and a `depends_on` chain stops the dependent together with its dependency. Only Docker Swarm honours start-first. The Dokploy host (`srv1052905`, Engine 28.3.3, 4 vCPU / 16 GB) is already a single-node Swarm manager, and other apps on it already run as Swarm services.

## Recommendation: move only the api to a Dokploy Application

A Dokploy **Application** runs as a Swarm service, and its Advanced → Swarm Settings expose a health check, update config and rollback config. That is the same mechanism Siera's api uses. Siera is set to `Stop First`, though, so it is not zero-downtime today.

Why the api alone, and not the whole compose app as a Stack:

- **It is the only user-facing service with a long boot.** web is nginx and restarts in seconds behind Caddy's retry window, while worker and beat are not on the request path.
- **No registry or CI build is needed.** An Application builds from git on the host, like compose does now. With one replica on one node, Swarm uses the locally built image. Siera's api also runs 1 replica with no registry. A registry is needed only for more nodes or more replicas.
- **A Stack is a much larger change.** `docker stack deploy` ignores `build:`, so every image needs a CI build-and-push. It also ignores `depends_on`, and it changes how the one-shot migrator runs. All of that would be extra risk for services that don't need start-first.

## Prerequisites (this PR, no behaviour change)

A Swarm service can't join compose's bridge `default` network, only overlay networks. Putting `plane-db` and the other services on the shared `dokploy-network` would expose them to every project on the host. Other projects there already reuse names like `ai` and `mcp` (see 5c7b704e), and compose always registers the service name, so `plane-db` would collide too. Instead:

1. **Private overlay network.** Compose creates `summon-core-internal`, an attachable overlay (the host is a Swarm manager). The api's dependencies (`plane-db`, `plane-redis`, `plane-mq`, `plane-minio`, `codex-bridge`, `transcription`, `live`, `mcp`) and its callers (`live`, `mcp`, `ai`) join it next to `default`. Only summon-core services are on it, so plain names like `plane-db` stay unambiguous, and the hard-coded hosts in `docker-entrypoint-secrets.sh` keep working unchanged.
2. **One switch for the api's address.** The proxy (`API_HOST`), `live` (`API_BASE_URL`), `mcp` (`PLANE_INTERNAL_BASE_URL`) and `ai` (`DJANGO_URL`) now read `API_INTERNAL_HOST`, which defaults to today's `summon-core-api`. Cutover flips this one Dokploy environment variable.

Tested locally, on Docker Engine with a single-node Swarm and Compose v5.5:

- **Adding the second network** to a running compose project recreated the containers once and they came back. Changing the `default` network's driver in place stopped the containers and failed to start them again, even on a second `up`. So the default network stays as it is.
- **A Swarm service on the overlay** resolved the compose `plane-db` by name, and compose containers reached the service by its alias.
- **A start-first update of that Swarm service:** 120 requests from a compose container (every 0.25 s) had **0 failures**. v1 served until v2 was healthy, both answered for a moment, then only v2.

**First deploy of this PR:** compose recreates every service that joins the new network, including `plane-db`, `plane-redis` and `plane-mq`. Expect one restart blip of the data services, then none.

## Dokploy Application settings

| Setting           | Value                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source            | this repo, branch `main`, autodeploy on                                                                                                                                   |
| Watch paths       | `apps/api/**` (only api changes redeploy it)                                                                                                                              |
| Build             | Dockerfile `apps/api/Dockerfile.api`, context `apps/api`                                                                                                                  |
| Command           | `./bin/docker-entrypoint-secrets.sh ./bin/docker-entrypoint-api.sh`                                                                                                       |
| Environment       | the `x-app-environment` block (hosts unchanged: `plane-db` etc. resolve on `summon-core-internal`)                                                                        |
| Volumes           | bind `/etc/dokploy-secrets/summon-core-plane` → `/run/secrets` (read-only); `*_FILE` envs keep their paths                                                                |
| Networks          | `dokploy-network` (Dokploy default, so the proxy can reach it) and `summon-core-internal`, alias `summon-core-api-next` on both                                           |
| Replicas          | 1 (Swarm runs 2 only during an update)                                                                                                                                    |
| Health check      | `["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/', timeout=3)"]`, interval 5 s, timeout 5 s, start period 300 s, retries 3 |
| Update config     | parallelism 1, delay 0, order **start-first**, failure action **rollback**, monitor 30 s, max failure ratio 0                                                             |
| Rollback config   | parallelism 1, order start-first                                                                                                                                          |
| Stop grace period | 40 s (gunicorn's 30 s graceful timeout, plus margin)                                                                                                                      |
| Resources         | reserve 0.5 CPU / 768 MB, limit 2 CPU / 2 GB (two tasks overlap during an update)                                                                                         |

Swarm only adds a task to the service's virtual IP once its health check passes. The old task keeps serving until then, and only stops after the new one is healthy. A task that never turns healthy triggers the rollback, and the old one keeps running.

## Cutover

1. **Merge the prerequisites PR.** Verify that the compose deploy is healthy and every caller still works.
2. **Create the Application** with alias `summon-core-api-next` and deploy it. The compose `api` keeps serving all traffic. From the proxy container, `curl http://summon-core-api-next:8000/` should return the health JSON.
3. **Switch traffic:** set `API_INTERNAL_HOST=summon-core-api-next` in the compose environment and redeploy. Probe from outside and sign in once.
4. **Remove the compose `api` service** (PR), give the Application the alias `summon-core-api`, and unset `API_INTERNAL_HOST`.
5. **Prove it:** push a no-op change under `apps/api`, run the external probe through the deploy, and expect 0 errors and no request slower than normal.

**Rollback at any step:** unset `API_INTERNAL_HOST`, which points back to the compose api, and redeploy. Until step 4 the compose api is untouched.

## Rules that come with start-first

- **Migrations must be backward-compatible (expand, then contract).** The old api keeps serving while the migrator applies the new schema. The new api's `wait_for_migrations` holds it unhealthy until migrations finish, so it never serves early. The old code must tolerate the new schema for that window, which was already true in practice.
- **Two deploy triggers fire per push** (the compose app and the Application). Each is safe on its own: the migrator lives in compose, and the api waits for migrations.

## To verify before starting

- Whether "Isolated Deployment" is on for summon-core, and how Dokploy attaches `dokploy-network`. It must leave the explicit `networks:` lists intact.
- That this Dokploy version exposes the same Swarm Settings as Siera's instance (v0.29.8), and that a single-replica Application builds without a registry.
- The api's memory under load, to size the overlap of two tasks.

**Estimate:** about half a day for the prerequisites PR and cutover. Then one probed deploy to prove it.
