# Native file asset owner

## Boundary and invariant

`assets/index.ts` owns upload intent and lifecycle; `assets/upload.ts` validates uploaded bytes. Every operation checks current workspace, optional project, and optional document permissions through their existing owners. Document lock/archive blocks writes. A workspace administrator cannot bypass project or private-document access. Only the user who prepared an upload can finalize it.

Prepare returns a Convex signed upload URL and stable asset ID. The caller provides filename, canonical MIME type, byte length, and base64 SHA-256 digest. POST bytes to that URL, then call `assets.upload.finalize` with the resulting storage ID. Finalization checks immutable storage metadata against the intent, uniquely claims the blob, checks its actual MIME and signature/UTF-8, then rechecks authorization before publishing. Pending files are never downloadable. Digest binding prevents swapped bytes; it is not malware scanning.

`assets.index.get` returns metadata and `downloadPath`, never a persistent public storage URL. Fetch the path on the Convex site origin with `Authorization: Bearer <JWT>`. The HTTP owner checks access on each request and returns an attachment with `private, no-store`, `nosniff`, and sandbox headers. Browser editor integrations must fetch authorized bytes and own/revoke object URLs; a plain image URL cannot carry this authorization header.

Images are limited to 5 MiB (PNG/JPEG/GIF/WebP); PDF and UTF-8 text/Markdown/CSV to 10 MiB. SVG, HTML, Office archives, audio, and arbitrary binaries are not yet supported. Signature checks do not establish full parser safety or absence of malware.

## Cleanup

Tickets expire after one hour. Hourly internal cron expires tickets and deletes claimed unfinished bytes. A separate paginated sweep deletes unclaimed blobs older than 24 hours, covering upload completion without finalization and failed validation before claim. Failed content validation deletes only the uploader's already-claimed blob; invalid arbitrary storage IDs never cause immediate deletion. Ready assets and soft-deleted assets inside their seven-day undo window survive cleanup. This is currently the only Convex `_storage` owner; future storage domains must extend its reference registry before they store files.

Delete checks current write access and immediately withholds downloads, retaining bytes for seven days to support editor undo. Restore checks the same current scope, document binding, lock, retention deadline, and physical bytes. Duplicate copies bytes into an independently owned storage ID so deleting a copy cannot damage its source. The editor-facing resolver normalizes persisted string IDs at the database owner, binds them to the active document, returns null for missing/nonready files, and preserves authorization errors. The policy query exposes canonical supported types and limits.

## Legacy trace and remaining migration

Django owners: `plane/db/models/asset.py`, `plane/app/views/asset/v2.py`, and `plane/bgtasks/file_asset_task.py`. Existing editor integration: `apps/web/core/hooks/editor/use-editor-config.ts` and `packages/editor/src/core/types/config.ts`. Legacy entity attachments, cross-document duplication, issue/comment attachment relations, avatar/logo replacement, audio/transcription, assistant artifacts, PDF extraction, and external workers are not migrated by this storage slice. Existing frontend file hooks remain on Django until adapted explicitly. There is no claim of full FileAsset parity or permission to retire those legacy paths.

## Verification

Module-local behavior tests cover pending visibility, authorized read/delete, outsider and uploader isolation, revoked membership before finalization, byte substitution, MIME spoofing, invalid intents, document locks, cross-workspace scope, expiry, orphan cleanup, physical copy independence, seven-day undo, locked undo denial, and expired-copy cleanup. Whole backend: 122 tests passed with this slice; native TypeScript and Oxlint passed.

Actual local backend smoke on 2026-09-26T23:05:50Z: fresh Password signup/JWT, signed upload POST 200, finalized authorized byte download 200 with exact body, anonymous download 401, post-delete download 403. Evidence: `/tmp/summon-migration-control/assets-smoke.json`; asset ID `nd75mj7txbtvx2t58zxkkxsab18f4e4v`. This is local runtime evidence, not Dokploy or browser/editor acceptance.
