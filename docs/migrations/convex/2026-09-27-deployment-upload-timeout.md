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

## Original proposal — application recorded below

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

## Approved application and recovery attempt

The user subsequently explicitly approved: “Apply 300 seconds and reload.” The operator re-read the rendered configuration and confirmed it matched the reviewed original, inserted only the proposed websecure timeout block, saved through Dokploy, and invoked Web Server → Traefik → Reload. The UI reported “Traefik config Updated” and “Traefik Reloaded.” Reopening the complete editor after reload confirmed its trimmed contents exactly matched the original plus the approved block; certificate storage/challenge, HTTP3 and TLS fields were preserved.

Post-reload reachability checks returned HTTP200 for Dokploy/dashboard/home (5.567s), Convex core/version (4.443s), site/.well-known/openid-configuration (2.954s), and convex-dashboard.withsummon.com (2.999s). These checks prove endpoint reachability, not the subsequent deployment result.

The immutable `8cad0b32a2` backend archive passed native TypeScript before one serialized remote push. Its get_config_hashes request returned200 in19.330s, then evaluate_schema began at2026-09-27T11:58:37.253Z. Evaluation succeeded with HTTP200 after290.165s at12:03:27.418Z, and the CLI confirmed no indexes would be deleted. The subsequent start_push encountered four network TypeErrors after284.515s,10.107s,180.257s and67.374s. The CLI performed its built-in bounded retries; no new deployment process was launched. The fifth start_push returnedHTTP504 after304.695s at12:17:42.457Z, without the inspected origin headers. The process exited1 and finish_push was never reached. Remote8cad activation remains unverified. No additional push or broader timeout/security/network change was made.

Read-only transport inspection confirmed evaluate_schema and start_push use the same request object and Brotli quality4 encoding, not a raw-JSON upload for start_push. RuntimeNode22.18.0/bundledUndici6.21.2 defaults to300-second header/body deadlines, but observed varying TypeError durations do not establish their cause. No HTTP(S)/ALL/NO proxy or NODE_USE_ENV_PROXY/NODE_OPTIONS setting was present in the process or deployment file. CLI installs its explicit proxy agent only when HTTP_PROXY/HTTPS_PROXY is present. Identical offline compression took50ms. During retries, core/version returned200 in0.529s and siteOIDC200 in3.324s. Small-request health does not prove large-upload health. Error cause codes were not captured by the active logger; a separate cause-code-only logger was prepared but not executed. Further transport strategy requires review; no further timeout increase or push is authorized by this receipt.
