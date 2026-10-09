# Project cover upload and recovery

## Owner and inherited boundary

The inherited project model stores `cover_image` and `cover_image_asset`; `cover_image_url` prefers the uploaded asset. Project form/header/card consumers use the image picker, with administration controls. The inherited picker also offers bundled images and Unsplash/external URLs. This slice implements authenticated uploaded images and recovery; those external/static picker choices remain pending.

A separate `projectAppearance` row owns `coverAssetId` and its revision. No row means an unset cover at revision zero. This is independent from project metadata revisions, so changing a name does not invalidate an in-flight cover upload. Current project read permission authorizes bytes; current project administration plus workspace write permission authorizes publication, replacement, removal and recovery.

## Reused production paths

The existing asset preparation, MIME/signature/digest validation, storage finalization, authenticated HTTP reader, expiry cleanup, and seven-day removal lifecycle remain authoritative. `projectCover` is a distinct asset purpose with a captured appearance revision. Finalization repeats current ACL and revision checks atomically with selecting the cover. Generic asset removal cannot bypass the appearance owner. A replacement soft-removes the previous cover; recovery atomically replaces the current cover with retained bytes.

The frontend reuses `FileAttachmentUpload` and extracts the existing authenticated logo image reader into `assets/image.tsx`. Header initials, compact logo rendering, abort-on-unmount, source-path matching and blob URL disposal remain intact. Project settings and project header activation follow backend deployment.

## Verification

Four project-cover behavioral tests cover finalize retry, replacement, authenticated bytes, recovery, stale competing uploads, unrelated metadata edits, archive/revocation during upload, guest reads, cross-project and cross-purpose rejection, and expired recovery. Seven existing workspace logo tests also pass. Native backend and web TypeScript checks pass; scoped Oxc reports no warnings/errors. Classic complexity is at most 10 across the new backend owners (restore 9, replacement 8).

After the parent removed the obsolete intake metadata-migration fixture, the full backend suite passes 571 tests across 90 files. Frontend module behavior tests pass 50/50. Exact backend commit `5207aa69cf` passed archive TypeScript validation and deployed locally at `http://127.0.0.1:3210`; log `/tmp/summon-migration-control/project-cover-5207aa69cf-local-deploy.txt`. Remote deployment remains held. The settings and header consumers are mounted; browser acceptance remains parent-owned and unverified at this checkpoint.

## Primary Chrome acceptance

Local3010 with backend5207aa69cf: Northstar Release initially had no cover.
Uploaded synthetic workspace-logo-qa.png, replaced it with the replacement
fixture, then restored the original through Removed covers and its explicit
confirmation. The replacement appeared in recovery after restoration.
Navigating to Tasks rendered the restored cover in the project header.
Desktop and390px screenshots were inspected: bounded cover, wrapped navigation,
no horizontal overflow (document width390). The low-resolution square fixture
is visibly cropped/enlarged by the cover treatment; this is not image-quality
evidence for a production banner. Temporary viewport overrides were cleared.

Removed the original through the seven-day recovery flow, returning the project
to its original no-cover state. No permanent purge was performed. Current
metadata/timezone remained intact. Guest/revocation behavior is BDD evidence,
not browser acceptance; external/static URL selection remains a parity gap.
This acceptance is local dev only, not remote activation or a served production
build claim.
