# Workspace logo owner

## Source contract and supported slice

Legacy `Workspace.logo_asset` overrides nullable historical `logo` text in `logo_url`. The current workspace settings upload modal calls `WorkspaceFileAssetEndpoint` through registered `assets/v2/workspaces/<slug>/[<asset_id>/]` routes. Upload requires admin; finalize replaces the pointer and soft-deletes the prior logo. Legacy asset restore only clears deletion flags; it does not reattach the logo. Legacy finalization/deletion/restore have broader membership decorators than upload.

Native `settings/logo` owns the pointer in `workspaceAppearance`, whose absent row means no uploaded logo. It uses the existing required workspace metadata revision, shared asset upload/finalize validation, authenticated HTTP bytes, and cleanup. No legacy row requires backfill for this new purpose. Optional asset purpose/revision fields identify only logo intents; unrelated assets retain their established scopes.

Current workspace admin is required for every write, including async claim and commit. All current workspace members may read the active logo. Admin-only removed-logo pages are indexed, 1–50 items, capped at 100 rows/1 MiB read; pagination preserves cursor and completion state. Removed metadata remains available after expiry but restoration explicitly rejects expired or missing bytes. This query does not claim timer-driven reactive expiry.

## Atomicity and recovery

Preparation captures metadata revision; commit rechecks it after byte validation. Competing uploads or intervening metadata edits cannot displace a newer logo. Publication, prior-logo soft deletion, new pointer and revision increment are one transaction. Finalize retry for an already ready asset does not increment revision again. Remove additionally binds the captured current asset ID. Restore binds workspace + removed asset ID + current metadata revision, checks seven-day retention and existing bytes, and atomically displaces the current logo. Current creator identity cannot be reassigned. Generic asset removal rejects logo assets; document restore/duplicate require document scope and cannot reattach them.

Rejected content is cleaned by the existing asset owner. Interrupted/stale uploads retain pending intent cleanup and orphan sweeping; failed CAS does not delete an unrelated active logo. Supported images and 5 MiB limit derive from canonical PNG/JPEG/GIF/WebP validation. Signature validation is the existing check, not full decoding or malware scanning.

## Evidence and remaining contracts

Six module-owned logo behavior tests plus existing settings/assets tests pass (52 tests across seven files); native TypeScript 7 and scoped Oxc pass before commit. Tests cover upload/replace/remove/restore, current admin loss between claim and commit, authenticated read, foreign workspace recovery, current-pointer mismatch, competing uploads, settings CAS conflict, missing/expired bytes and spoof rejection. Browser/UI acceptance is pending and recorded separately.

Legacy REST compatibility, historical arbitrary `logo` URL assignment/S3 deletion, workspace `background_color` (opaque max255 field without a current workspace UI consumer), themes, workspace deletion and project cover images remain separate contracts. No opaque fields are converted or discarded, and no hex-only background restriction is presented as parity.
