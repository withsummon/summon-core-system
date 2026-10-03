# Task attachments: native storage integration

## Canonical owner and workflow

`assets.taskAttachments` adds task attachment prepare, access, bounded list, normalized detail, remove and restore. `assets.task_access` owns task/intake permission selection and uploader/admin management. Task ID is stored on the existing asset; there is no parallel blob/reference owner. Intake acceptance keeps this ID, so attachments follow the same canonical task automatically.

Upload uses existing prepareAsset → signed storage POST → assets.upload.finalize → claim/content validation/commit. Both claim and commit recheck current task/intake access, even across asynchronous validation. Uploader identity is assigned once at preparation and never rewritten. Ready commit is idempotent and touches the task revision/event only once. Generic asset prepare/remove reject task-scoped requests; document-only restore/duplicate cannot be used for task assets because their scope must match a document. Mixing task with document/conversation or mismatching task project/workspace is rejected by the asset scope owner.

Authenticated `/assets/{id}` uses the same task/intake access owner, attachment disposition, no-store and nosniff protections. No public storage URL or JWT-bearing download URL is returned. Descriptors omit storage IDs. Existing document, conversation and workspace assets retain their access branches; the shared scope owner dispatches to each domain's validator.

## Exact role/lifecycle contract

- Ordinary active-task upload/read allows current project members including guests, matching IssueAttachmentV2Endpoint post/get/patch. Native canonical task read still governs task existence. Ordinary attachment reads do not introduce the saved-view/history guest restriction, because this legacy attachment controller does not apply it.
- Triage task reads/uploads explicitly pass through requireIntakeTask. Noncreator guest access follows guestViewAllFeatures; task-status acceptance later switches to ordinary task access. There is no broad project-only bypass for a pending submission.
- Removal/recovery is asset uploader OR project administrator OR workspace administrator with current project membership. It is not task-creator permission. Evidence: `app/views/issue/attachment.py` delete uses `@allow_permission([ROLE.ADMIN], creator=True, model=FileAsset)`; `app/permissions/base.py` PROJECT branch admits workspace administrators only while an active project member. Native also requires current active workspace membership. Legacy creator-only exceptions outside project membership are deliberately not reproduced.
- Archived tasks retain readable files but reject upload, finalize, remove and restore. Deleted tasks deny list/detail/bytes; task recovery exposes retained ready assets again. Pending/deleted assets never serve bytes. Removed-file metadata is visible only to uploader/admin under current task read access.
- Attachment removal retains bytes for seven days. Restore checks current task permission, uploader/admin identity, exact attachment revision, expected status, expiry and storage existence. Attachment revision is initialized for every new task asset; optional schema presence is exclusively for older non-task assets. Task revisions and ordinary updated events use taskChanged on first upload commit, removal and restore.

## Policy and cleanup

No MIME types or size limits were added: PNG/JPEG/GIF/WebP images up to 5 MiB; PDF, UTF-8 plain text/Markdown/CSV up to 10 MiB. The existing content owner now publishes its canonical extension-to-MIME map in assets.index.policy so an empty browser MIME can be resolved without a second client policy. Declared MIME, bytes/signature, digest and size are still verified at finalization. The mapping is not a content-validation bypass.

Existing pending expiration and storage sweep remain the sole cleanup owner. Seven-day deleted retention is already understood by that sweep. Lists read at most 100 indexed task/status candidates and 1 MiB; no attachment count or all-page completeness claim is made. Restore capability reflects the query evaluation time; time alone does not invalidate a Convex subscription. The mutation authoritatively rejects expiry and the response exposes the deadline for UI display.

## Legacy paths and omissions

Active legacy consumer `services/issue/issue_attachment.service.ts` performs metadata POST, direct storage upload, then completion PATCH. Its V2 routes are `/api/assets/v2/workspaces/{slug}/projects/{projectId}/issues/{issueId}/attachments/` and `.../{assetId}/`. The task-detail attachment store/widgets consume those results. `app/views/issue/attachment.py` also owns separate V1 multipart routes and attachment activity notifications.

This slice does not migrate V1 multipart, REST/PAT/public aliases, attachment-specific activity/notification wording, metadata enrichment/previews, exact legacy file-size configuration, task editor inline images or rich attachment-count projections. Legacy supports Office/ODF/SVG/TIFF/BMP/audio/video/archive formats beyond native validated policy; those remain staged, not silently accepted. Native recoverable removal differs from legacy V1 physical deletion and its irreversible UI copy. Existing Django routes remain registered.

## Verification

`assets/__tests__/task-attachments.test.ts` adds five journeys: guest upload/read/idempotent finalization and CAS recovery; uploader versus task creator and generic bypass denial; archive/revocation/deletion across claim/commit plus task recovery; intake guest flag changes and acceptance identity; archive reads/write denial and seven-day cleanup. Existing asset/document lifecycle tests run unchanged. Full backend at this checkpoint: 312 tests across 38 files; native TypeScript and scoped Oxlint pass. New/reorganized attachment ACL/control-flow owners pass complexity≤10; the untouched existing upload-claim function remains at its prior complexity16 and was not broadly refactored. Browser/download verification and deployment are separate gates; neither is claimed here.
