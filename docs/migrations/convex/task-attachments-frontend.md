# Native task attachments frontend

## Owner trace

Legacy issue detail uses `issue-detail-widgets/attachments` and delegates operations to the issue attachment owner. Its V2 API prepares storage uploads, tracks attachment records, checks membership and creator/admin removal, and supports substantially more MIME types than native assets.

The native task/intake section reuses the existing `AssetTransfers` byte/abort/object-URL owner and `uploadedStorageId` response boundary used by documents and assistant attachments. Task-specific authorization and lifecycle belong to the generated `assets.taskAttachments` API. File bytes are fetched through the existing authenticated site endpoint with an Authorization header, no-store, and omitted cookies. Credentials are never embedded in URLs.

## Experience and boundaries

This is an established task-detail attachment section, not a separate screen redesign: compact file name/type/size rows, upload action, actual download, and explicit removed-file recovery. Ordinary archived tasks remain read-only according to canonical capabilities. Deleted tasks do not render this section. The task ID reaches the asset owner for both ordinary tasks and intake, so the UI does not duplicate intake visibility rules.

Native supported formats remain PNG, JPEG, GIF, WebP, PDF, UTF-8 plain text, Markdown, and CSV with the current owner limits. Legacy Office documents, audio/video, archives, additional image formats, and broader MIME coverage remain migration gaps. No full attachment parity claim.

## Verification

The single-file uploader validates against the published MIME/extension/size policy before preparing storage. Empty browser MIME uses only the canonical extension mapping; an explicit unsupported MIME is rejected. The upload body carries the resolved content type and the existing finalizer verifies bytes. File lifecycle confirmation captures its canonical revision. Downloads reauthorize the descriptor and actual HTTP bytes on every click. Leaving the row/task aborts transfers and revokes its blob URLs. A subsequent completed download releases the previous URL through the shared transfer owner, bounding retained URLs to one per attachment row without an arbitrary timer or immediate revocation of the clicked URL. Both task/intake attachment sections are keyed by task ID, and rows by asset ID.

Seven focused behavior tests passed: two attachment-policy cases and five transfer cancellation, response validation, and URL cleanup cases. Five backend attachment behavior tests also passed. Scoped nine-file lint, diff whitespace checks, and native web TS7 passed. Backend peer review sampled MIME resolution, typed upload body, authenticated HTTP, lifecycle revisions, and keyed transfer lifetime without a blocking finding. Recovery capability may remain visible until another reactive update after its displayed deadline; the mutation enforces the actual expiry. Remaining browser coverage: PNG/PDF/Markdown, stale lifecycle conflict, archived read-only, intake privacy, unsupported/oversized rejection and cancellation/navigation. No new dependency was added.

## Primary verification, 2026-09-27

312 backend tests across 38 files and all 24 frontend tests passed. Root native TS7 passed 30 tasks; lint and formatting each passed 21 tasks. Scoped new code has zero lint warnings; root lint retains its recorded legacy warning baseline. Local function deployment succeeded on port 3210 at 13:54:11.

Chrome on local port 3010 verified a 92-byte synthetic text upload on NSTAR-5, finalized visibility, and authenticated download. The browser tool's download-event waiter timed out, but the actual file in Downloads matched the original fixture SHA-256 exactly; this is observed artifact evidence rather than an assumed successful click. Removal disappeared live from the guest tab. The uploader could see the removed file and seven-day deadline and restore it; the non-uploader guest saw no remove control or removed-file metadata. A guest upload then completed and exposed that guest's own remove action. Both synthetic uploads remain on the task.

Desktop and 390px screenshots showed readable filenames, metadata and controls; narrow document width equaled viewport width (390px). The temporary viewport override was cleared. Native task/intake mounting and the broader role/lifecycle cases are covered by source review and BDD; the unexercised browser cases above remain explicit. The production web build also passed. Remote attachment deployment remains a separate gate. Independent final review found no blocking findings across generic asset bypasses, uploader identity, asynchronous finalization, restore and frontend transfer lifetime; already-ready retry after archive/revocation was source-verified rather than covered by a dedicated new assertion.
