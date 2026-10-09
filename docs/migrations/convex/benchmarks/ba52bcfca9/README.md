# Expanded native checkpoint measurements

Control artifact: `05f894b84bbde4e2474b82f17be7f4578bc15f14` (unchanged `apps/api` source), control image `sha256:025f9c48a908cb638c379c99cfe1a3e0832077467c128a4f41af8a003234b232`. Candidate artifact: `ba52bcfca92f025bc2f6acbb901ff72813cbbf2c`; its backend code was deployed locally at 07:07:41 Asia/Jakarta on 2026-09-27. The checkpoint then normalized generated formatting and made the Convex build environment explicit.

**Directional local evidence. The contracts are not equivalent, so these measurements do not establish a full-product speedup or permit legacy retirement.**

## API trials

The same harness and production-mode Django control described in the [original methodology](../README.md) were rerun against a fresh, isolated 500-task fixture. Three trials each measured 50 authenticated first-page reads, 50 task status writes, and 30 second-client subscription observations. Backend order alternates within each trial. Warmup and committed-state checks passed. No build was running during these samples. Raw measurements and exact runtime descriptions accompany this report.

| Operation                                 | Median of trial p50 | Range of trial p95 |
| ----------------------------------------- | ------------------: | -----------------: |
| Django first 50 tasks                     |            38.74 ms |     76.82–77.27 ms |
| Convex first 50 tasks                     |             1.32 ms |       1.66–1.92 ms |
| Django status write                       |            30.69 ms |     32.67–35.39 ms |
| Convex status write                       |            13.21 ms |     15.94–17.94 ms |
| Convex write to second-client observation |            19.90 ms |     21.64–22.44 ms |

Django read bodies were 32,636–32,670 bytes; serialized Convex results were 23,893 bytes. Convex protocol envelopes are excluded. Django still returns richer inherited records and has different side effects. This checkpoint adds task properties, activity and notification behavior beyond the first native slice; neither backend comparison nor cross-checkpoint comparison isolates one implementation change. There is no equivalent Django subscription measurement, throughput/capacity test, or cost result.

## Production browser

The complete production build passed 16/16 tasks. Its immutable output was copied to `/tmp/summon-production-ba52bcfca9` and served on `http://127.0.0.1:3013`; the HTTP `/core` body matched the SHA-256 in `production-manifest.json`. The working build preserved the user's preexisting dependency additions; this is recorded in that manifest rather than represented as a clean checkout build.

Chrome used the earlier, separate 500-task `Migration benchmark` workspace. Ten warm project selections took **31.8–49.5 ms** from the select's change event to two animation frames after 50 task controls appeared. This differs from the previous first-slice click-based probe, so no before/after percentage is claimed. Three HTTP-cache-disabled reloads had FCP at **136, 124 and 140 ms**, 43–46 resources and 377,725–383,872 transferred bytes. Existing authentication and backend caches stayed warm. Each completed page displayed 50 rows; FCP does not measure when protected content was ready.

A task detail opened with saved description, state, hierarchy, relationships and comments controls in this production build. A captured full task-route reload showed the local Convex HTTP/WebSocket origins, including `/api/1.46.0/sync`, and no requests to `/api/summon/` or the Django ports 8000/8002. The event buffer was complete, not truncated; this establishes this route only. These browser timings are candidate-only synthetic observations, not Core Web Vitals, RUM, an SLO or comparison with the complete legacy frontend. Invalid/unsupported instrumentation attempts were excluded; browser cache settings were restored and page instrumentation removed.

## Acceptance boundary

At the measured checkpoint, 206 Convex behavioral tests, 30 typecheck tasks, 21 lint tasks, 21 formatting tasks and 16 production build tasks passed. Module receipts separately describe Chrome role, conflict, notification, document collaboration and recovery checks. These counts do not establish full legacy feature parity or remote deployment success. See the [endpoint inventory](../../endpoint-parity.md) for unresolved caller and contract ownership. Remote DNS/TLS, a real LLM provider, external MCP execution, inherited Plane features and mixed-load/recovery acceptance remain separate gates.
