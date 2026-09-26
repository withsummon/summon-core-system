# First-slice performance evidence

Control artifact: `05f894b84bbde4e2474b82f17be7f4578bc15f14` (Django API source), base image `sha256:025f9c48a908cb638c379c99cfe1a3e0832077467c128a4f41af8a003234b232`, with the repository's pinned Gunicorn 23.0.0 installed in an isolated benchmark container. Candidate owner: `c6484ec885`; Convex backend digest is pinned in the compose file.

**Verdict: the candidate has promising local latency, but this does not prove a full-product speedup or justify Django retirement.** The candidate task contract is smaller, and these are local synthetic measurements.

## Contract and environment

Measure authenticated first-page reads and alternating task status writes with 500 synthetic tasks. Preserve workspace/project authorization, committed state readback, and a second client's observation of committed status. Both use HTTP clients on the same Apple-silicon host (48 GiB RAM, Docker memory ceiling 15.66 GiB), Node 22.18.0, loopback networking. The Django control uses Gunicorn with two Uvicorn workers, `plane.settings.production`, `DEBUG=0`, and PostgreSQL 15.7. Convex uses its native self-hosted binary and SQLite.

Each of three trials warms ten reads per backend, then records 50 reads and 50 writes per backend in alternating backend order. Each trial also records 30 updates observed by a second independent Convex subscription client. Writes start from a known state and final database reads validate the result. Initial failed harness attempts and development-server trials were excluded.

The originally running Django container was `manage.py runserver` with local settings (which force DEBUG on despite its environment variable). That was an unsuitable production comparison; a separate Gunicorn container was started without changing or stopping the existing service.

## Results

| Local operation                          | Median of trial p50 | Range of trial p95 |
| ---------------------------------------- | ------------------: | -----------------: |
| Django first 50 tasks                    |            40.77 ms |     48.40–76.98 ms |
| Convex first 50 tasks                    |             1.32 ms |       1.90–2.36 ms |
| Django task status write                 |            30.57 ms |     32.69–34.07 ms |
| Convex task status write                 |             9.86 ms |     12.29–12.96 ms |
| Convex write → second client observation |            13.08 ms |     14.56–18.61 ms |

The read payloads were about 32.7 kB for Django and 18.0 kB for Convex. This is partly a contract difference: Django includes fields and inherited side effects that the candidate does not yet implement. Repeated identical reads also do not establish uncached performance. No percentage speedup is reported. Django's current task UI does not have an equivalent subscription, so there is no fabricated realtime ratio.

## Browser evidence

A pinned snapshot of the first-slice production build was served on port 3012. Chrome rendered 50 task rows from the 500-task workspace. Ten warm project-selection runs took **28.4–39.0 ms** from captured click to two animation frames after those rows appeared. Three HTTP-cache-disabled reloads had first contentful paint at **260, 100, and 108 ms**, with 36 resource entries and about 363 kB transferred each time. Backend caches and the existing authenticated session remained warm.

These are candidate-only synthetic results, not Core Web Vitals/RUM or a before/after comparison against the complete legacy UI. FCP is not protected-content readiness. The warm result supports the provisional local navigation target; it does not establish a production p95 SLO.

The first static-server attempt exposed a global `path-to-regexp:0.1.13` override that broke `serve-handler`'s required `compile` API. Narrowing that override to the 0.1 release line restored the production deep link. Route cleanup also removed a root utilities-barrel dependency and deferred error UI; the separate benefit of those two code edits has not been measured against an otherwise identical build.

## Reproduction and remaining gates

Harnesses live under `apps/convex/benchmarks`; Django fixture creation is `tools/benchmarks/seed_django.py`. They use restricted session/fixture files under `BENCH_ARTIFACT_DIR` (default `/tmp/summon-migration-control`). Keep password/JWT/cookie files outside version control. For a new run, set `BENCH_ARTIFACT_DIR` to a fresh directory and run the following from the repository root. The preparation wrapper was smoke-tested with a separate 500-task fixture and both real authentication flows.

```sh
export BENCH_ARTIFACT_DIR=/tmp/summon-benchmark-new-run
export BENCH_CANDIDATE_ARTIFACT=<full-commit-actually-deployed-to-local-Convex>
node tools/benchmarks/prepare-local.mjs
node apps/convex/benchmarks/django-session.mjs
node apps/convex/benchmarks/auth-smoke.mjs
node apps/convex/benchmarks/seed-convex.mjs
node apps/convex/benchmarks/compare.mjs
```

Set `DJANGO_BENCH_CONTAINER` to the running local Django container if its name differs from the preparation script default. The benchmark HTTP target is separately configured. `DJANGO_BENCH_ORIGIN` defaults to the isolated production control at `http://localhost:8002`. Never point the fixture harness at real user workspaces.

Raw successful samples are in the three API JSON files; the browser JSON records its scope and method. Required before retirement: full functional/visual parity, production-sized mixed workloads, offline/reconnect and permission races, sustained load and recovery, backup/restore proof, and verified remote DNS/TLS/runtime identity. No throughput, capacity, or resource-cost reduction is claimed from these runs.
