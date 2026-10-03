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

## Remote stored-file recovery, checkpoint `27b80685f0`

After the remote task attachment journey created a synthetic stored file, another snapshot was restored into a new isolated volume on API port 3216/actions port 3217. The pinned backend image, committed functions and auth environment were restored separately. Before a fresh sign-in changed authentication rows, re-export comparison proved all 38 records across 59 tables and the single stored file equal. Fresh password authentication then returned the restored identity and its workspace.

The [receipt](checkpoints/27b80685f0-remote-restore.json) records the exact source snapshot hash and result. Mode-restricted source/configuration files remain under `/tmp/summon-remote-file-restore-20260927`. No source import, source interruption or existing volume replacement occurred. This extends remote-source-to-local recovery evidence to stored bytes. A restored browser file download, Dokploy disaster recovery, scheduled encrypted retention and recovery-time objectives remain separate gates.

## Dokploy backup schedule audit, 2026-09-28

The production Convex compose service has a named backend volume, `summoncore-convex-jp8som_data`, and Dokploy's Volume Backups tab shows **no configured backup**. An `r2` S3 destination exists, but its bucket access policy and retention were not verified. [Dokploy's volume backup guidance](https://docs.dokploy.com/docs/core/volume-backups) recommends stopping a container during a volume copy to avoid inconsistent database files; that option would interrupt Convex. [Cloudflare R2 encrypts stored objects by default](https://developers.cloudflare.com/r2/reference/data-security/), but [Dokploy does not encrypt the backup archive itself](https://docs.dokploy.com/docs/core/guides/production-hardening) before upload. Prefer a [consistent Convex export including file storage](https://docs.convex.dev/database/backup-restore) for an online backup; require an isolated restore, authenticated browser journey and recovered file download before counting disaster recovery as accepted.

## Remote-source recovery, 2026-09-28

A new online export from `https://convex-core.withsummon.com` was imported into an empty, isolated local backend volume. Re-export before deploying functions matched **104 application/component tables, 108 records and two stored binaries** by canonical records and SHA-256. Source snapshot SHA-256: `0304ae48af0a406b070d0fa7a07788d501980f734167b14f772470252472ccb9`. The remote environment and candidate functions at commit `9c049fc2eb` were then restored separately. Fresh password sign-in returned authenticated identity and the restored QA workspace. The private snapshot, environment and instance key remain mode-restricted under `/tmp`; the remote source was not imported into or interrupted.

The QA account does not belong to the private project that owns either restored asset, so its asset queries correctly deny access. An authenticated file download by an authorized project member remains unverified. This rehearsal also does not establish an off-host schedule, Dokploy-volume disaster recovery, retention or an RTO. Importing after schema deployment failed because the empty instance had assigned different table numbers; the successful rehearsal imported into a fresh volume before deployment. The isolated container must advertise both its API and actions origins through `host.docker.internal`; otherwise Node actions cannot call its API even when browser queries work.

After the rehearsal, the committed functions were deployed to the remote backend with the existing Convex Auth issuer. Its HTTPS API version and legacy JWKS endpoints returned 200; the inactive Better Auth endpoint returned 404. Fresh remote password sign-in returned authenticated identity and the QA workspace. These checks establish reachability and session behavior, not a frontend cutover or an exact served build identity.
