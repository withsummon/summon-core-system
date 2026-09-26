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
