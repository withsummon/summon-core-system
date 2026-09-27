# Project cover upload and recovery

## Owner and inherited boundary

The inherited project model stores `cover_image` and `cover_image_asset`; `cover_image_url` prefers the uploaded asset. Project form/header/card consumers use the image picker, with administration controls. The inherited picker also offers bundled images and Unsplash/external URLs. This slice implements authenticated uploaded images and recovery; those external/static picker choices remain pending.

A separate `projectAppearance` row owns `coverAssetId` and its revision. No row means an unset cover at revision zero. This is independent from project metadata revisions, so changing a name does not invalidate an in-flight cover upload. Current project read permission authorizes bytes; current project administration plus workspace write permission authorizes publication, replacement, removal and recovery.

## Reused production paths

The existing asset preparation, MIME/signature/digest validation, storage finalization, authenticated HTTP reader, expiry cleanup, and seven-day removal lifecycle remain authoritative. `projectCover` is a distinct asset purpose with a captured appearance revision. Finalization repeats current ACL and revision checks atomically with selecting the cover. Generic asset removal cannot bypass the appearance owner. A replacement soft-removes the previous cover; recovery atomically replaces the current cover with retained bytes.

The frontend reuses `FileAttachmentUpload` and extracts the existing authenticated logo image reader into `assets/image.tsx`. Header initials, compact logo rendering, abort-on-unmount, source-path matching and blob URL disposal remain intact. Project settings and project header activation follow backend deployment.

## Verification

Four project-cover behavioral tests cover finalize retry, replacement, authenticated bytes, recovery, stale competing uploads, unrelated metadata edits, archive/revocation during upload, guest reads, cross-project and cross-purpose rejection, and expired recovery. Seven existing workspace logo tests also pass. Native backend and web TypeScript checks pass; scoped Oxc reports no warnings/errors. Classic complexity is at most 10 across the new backend owners (restore 9, replacement 8).

The first full backend run reports 571 passed and one obsolete intake metadata-migration fixture failure: that fixture removes the now-required project description. This unrelated cutover fixture is assigned to the parent. Browser acceptance and deployment are not yet complete for this slice.
