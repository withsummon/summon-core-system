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

## Native settings consumer

The workspace settings panel renders the current authenticated logo and admin-only upload, removal and recovery controls. Upload reuses `FileAttachmentUpload` and its transfer cancellation/byte validation path, with generated image MIME restrictions. Remove/restore confirmations hold the chosen asset and metadata revision; changing live results cannot silently retarget the operation. Authenticated preview uses request headers, no credential URLs, and revokes object URLs/aborts fetch on identity, asset or unmount changes. The initial slice rendered the logo in settings; the navigation consumer integration below subsequently closes that native surface gap.

Backend commit `8cad0b32a2` passed exact-archive TypeScript 7 and six logo tests, then deployed locally at `http://127.0.0.1:3210`; log `/tmp/summon-migration-control/logo-8cad0b32a2-local-deploy.txt`. Remote deployment is intentionally held by the ongoing deployment investigation. Frontend native TypeScript 7 and scoped 195-rule Oxc pass; optional complexity-10 checks pass for the new logo modules and frontend. The older shared asset access/claim owners exceed that optional complexity threshold; this is not represented as a whole-assets complexity pass. Browser functional and constrained-width verification remain pending parent QA.

## Root Chrome acceptance — 2026-09-27

Verified on the identified production artifact `d330786578` at port 3025 against local Convex, using the isolated `workspace-rename-qa-verified` workspace. Uploaded the existing synthetic Summon image as `workspace-logo-qa.png`; the authenticated preview loaded (192×192 natural pixels). Replaced it with a separately named upload and observed the original in Removed logos. Restoring the original atomically moved the replacement into recovery. Removed the active logo, observed “No logo uploaded”, then restored it from the recovery list. Each destructive/replacement consequence was shown in the captured confirmation; no permanent deletion occurred.

At 390×844, the rendered logo, upload, remove and recovery controls fit the viewport. DOM scroll width equaled 390, and the image was complete. The temporary viewport override was cleared. Final QA state retains the original logo; the replacement remains recoverable for seven days. Both test uploads used identical image bytes, so browser evidence establishes lifecycle/navigation/preview behavior; backend tests establish storage and authorization invariants. This does not claim remote activation or navigation-badge integration.

## Workspace navigation consumers

Inherited active workspace/sidebar dropdown consumers are `components/workspace/sidebar/workspace-menu-root.tsx` and `dropdown-item.tsx`, backed by `components/workspace/logo.tsx`. Native `workspaces.index.list` now projects the same canonical active logo descriptor alongside each already-authorized workspace; settings and list share `workspaceLogo`. This adds indexed appearance/asset database reads inside the existing subscription, not one client subscription per workspace. No storage ID or signed URL is published. A seventh behavior test proves guest membership, removal/restoration projection, revocation and authenticated byte denial.

Pending-invitation cards in inherited onboarding also render logos, but native invitees do not yet have workspace membership. This slice intentionally retains private byte access until acceptance; invitation authorization is not a bypass into workspace storage. The native top header brands the product, while its sidebar is the combined workspace chooser/current-workspace navigation.

The native sidebar chooser renders each projected logo through the same authenticated preview component, sized to 24px beside its workspace name. Unset/loading/unavailable images use the workspace initial without replacing its accessible button name. Asset changes remount the byte consumer, descriptor-path checks prevent stale URLs from rendering, and teardown aborts reads/revokes object URLs. No separate logo query is issued by each navigation row. Backend `2c9d13c0c4` passed native/exact-archive TypeScript 7 and 20 logo/workspace tests and deployed locally; remote untouched. Frontend TypeScript 7, scoped Oxc and compact preview complexity checks pass. Rendered sidebar acceptance remains pending separate Chrome evidence.
