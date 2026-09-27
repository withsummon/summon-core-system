# Local Convex restore rehearsal

## Verified result

An export from the local candidate (API port 3210), including file storage, was imported into a separate empty instance on port 3212 with its own Docker volume and admin key. Both instances used the backend image pinned in `deployments/convex/compose.yml`. The restored instance was exported again and compared with the original snapshot.

`restore-receipt.json` records the result: 31 tables, 2,820 records, and two stored files match exactly. Record comparison parses JSON and sorts by `_id`; system table-list metadata is excluded because it is export metadata rather than application records. Every stored binary is compared using SHA-256. The source snapshot hash identifies this exact rehearsal.

The source remained running. No source import, volume removal, or Django/Postgres retirement occurred. Snapshot archives and instance secrets are private files under `/tmp/summon-convex-restore-proof`, outside Git.

## Repeat safely

1. Export the source with `convex export --include-file-storage --path <private-source.zip>` using its existing admin environment.
2. Create an isolated backend with a new volume, distinct loopback ports and instance secret. Confirm its URL and admin key belong to that instance before importing.
3. Import the snapshot into that isolated empty instance, then export it again with file storage. Never use replacement import against a production or shared destination as part of this check.
4. Run `python3 tools/benchmarks/compare-convex-snapshots.py <private-source.zip> <private-restored.zip>`. A mismatch exits nonzero and prints counts/booleans only, without record contents.

## Limits

This verifies local record and file recovery. It does not verify remote Dokploy disaster recovery, scheduled backups, off-host retention, recovery time objectives, environment-secret restoration, function deployment, or a post-restore authenticated application journey. Application code and server environment must be restored separately. Keep exports encrypted and access restricted: auth records and private content are included.

## Remote-source recovery, 2026-09-27

A snapshot exported over validated HTTPS from `convex-core.withsummon.com` was imported into a new local instance on loopback API port 3214, with a separate named volume. Code commit `903cee21243acfacb92950ef7615b55513d80a84` and the remote auth environment were restored independently. Before authenticating, re-export comparison proved all 21 records across 57 tables equal. The remote source contained no stored files, so this does not add remote binary-recovery evidence.

The first post-restore sign-in issued a token, but identity lookup failed provider discovery: advertised actions origin `127.0.0.1:3215` was unreachable from inside that container. Changing this isolated instance's actions origin to `http://host.docker.internal:3215`, preserving its volume, and redeploying the same code fixed discovery. A fresh sign-in then returned authenticated identity and the restored workspace. This is why record equality alone was insufficient.

The [receipt](checkpoints/903cee2124-remote-restore.json) records source snapshot hash, image, code and results. Private snapshots/configuration stay in mode-restricted `/tmp/summon-remote-restore-20260927`, outside Git. No import or service interruption occurred on the remote source. This closes a remote-source-to-local authenticated recovery rehearsal, not Dokploy disaster recovery, scheduled encrypted retention, binary recovery or an RTO claim.
