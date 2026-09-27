# Remote deployment upload timeout — 2026-09-27

## State

Remote backend origin: https://convex-core.withsummon.com. Last confirmed successful remote backend checkpoint: `939aaf3e73`. The later exact `e0a9f7c817` archive passed TypeScript checks and deployed locally, but remote activation failed. Existing authenticated remote RQA2 content was verified by the primary agent in the production frontend on port3024 after the single authorized backend restart. This is data-access recovery evidence, not evidence that newer backend code deployed.

No credentials, private payloads or request headers are included in this receipt. No account disconnection, verification fabrication or live credential mutation occurred.

## Measurements

One approved temporary Node preload recorded only request method/path, UTC timestamps, elapsed time, status and selected response headers. It preserved original fetch arguments, response and errors, with no timeout or retry-policy changes.

| Request                           | UTC start    | Duration | Result                |
| --------------------------------- | ------------ | -------- | --------------------- |
| POST /api/get_config_hashes       | 11:39:18.564 | 2.419s   | 200, application/json |
| POST /api/deploy2/evaluate_schema | 11:39:21.339 | 61.274s  | 499                   |
| POST /api/deploy2/evaluate_push   | 11:40:22.753 | 60.426s  | 499                   |

Both failures contained none of the inspected `server`, `via`, `cf-ray`, `content-type` or `x-request-id` response headers. The CLI exited1 before start_push/finish_push. A concurrent /version control returned200 in2.413s.

One subsequent authorized curl request sent the equivalent full-module e0 evaluation payload, with the actual deployment credential inserted only in restricted temporary files. It used the CLI's JSON shape and Brotli quality4 encoding; no start/finish endpoint was called. HTTP502 arrived after61.816s, with only720,554 of1,986,176 bytes uploaded (36%, average11,656 bytes/s). TCP connect took1.177s, TLS1.322s, first response byte61.816s. The body had not completed uploading, so this request was not spending the entire timeout solely evaluating an already uploaded schema.

These results strongly support an incoming request-body deadline. They do not independently identify which network component generated the error. No repeated retry was performed after this measurement.

## Payload comparison

Installed CLI `--write-push-request --push-all-modules` produced offline payloads from immutable archives. A preload rejected all fetch calls; a fake credential placeholder was used. Both archives used the same installed dependency tree. These are complete-module comparisons, not the exact incremental bytes transmitted by earlier CLI attempts.

| Source     | Modules | JSON bytes | Brotli quality4 bytes |
| ---------- | ------: | ---------: | --------------------: |
| 939aaf3e73 |     318 | 10,331,313 |             1,972,838 |
| e0a9f7c817 |     330 | 10,432,549 |             1,987,592 |

The increase is101,236 raw bytes and14,754 compressed bytes (under1%). The largest shared editor Node dependency changed from6,976,297 to6,978,601 serialized bytes; document copy action added56,282 bytes. No large new dependency spike was found.

The schema delta is additive: projectMembers.by_workspace_user_active, optional assets.documentCopyId, and documentCopies with by_actor_request. No existing table/field/index deletion was found. The installed deploy CLI's `--allow-deleting-large-indexes` still runs evaluation; it does not skip this failing preflight and was not used as a workaround.

## Runtime observations and limits

The single authorized restart affected only staged Convex backend container849de119830f. Dashboard, volumes and legacy services were untouched. The sampled log window showed index loading at11:05:27 and startup/index recovery at11:21:05. Dokploy's viewer is virtualized; these samples do not establish an exhaustive latest event or a backend deadlock. Expanded time-filter retrieval remained loading. The default sample later exposed successful sync/OIDC requests at11:21:10–11:21:11.

Local running backend image digest was `sha256:b756b06641d15a55b5ec0692897ce5ad3715ddccfd02e1e213621e9e764255c8`. Remote Docker UI showed the backend repository but did not expose a verified running digest in the inspected surface. Image equivalence remains unverified.

## Proposed change — NOT applied

The rendered `/etc/dokploy/traefik/traefik.yml` has web:80 and websecure:443, with no timeout overrides. Traefik documents a default60s incoming request-body read timeout. The proposed minimal addition is:

```diff
   websecure:
     address: :443
+    transport:
+      respondingTimeouts:
+        readTimeout: 300s
     http3:
       advertisedPort: 443
```

All existing TLS, HTTP3, authentication and routing configuration would be preserved. This changes the deadline for **every HTTPS application using websecure**, including non-Summon applications, and permits slow requests to retain connections longer. Static configuration requires reload/restart; the actual Dokploy Web Server → Traefik menu exposes Reload. Neither configuration save nor Reload has been performed. User approval is pending because of the shared entrypoint scope.

No documented per-router incoming-body timeout equivalent was found. Upstream serversTransport responseHeaderTimeout applies after uploading the request and does not address this measured boundary. Separate entrypoint/proxy routing would be broader work.

References: [Traefik entrypoints and timeout defaults](https://doc.traefik.io/traefik/reference/install-configuration/entrypoints/), [startup versus dynamic configuration](https://doc.traefik.io/traefik/getting-started/configuration-overview/).

## Separate mail configuration gate

The user selected Resend only. The supplied key was verified by the primary agent without exposing it; its domain list was empty. Sender/domain selection and domain verification remain pending. Mail availability must not be enabled until the sender is established and verified. No key or private payload belongs in this repository.
