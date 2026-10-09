# Task description inline images: backend owner

## Scope and existing owner

The inherited rich-description input supplies issue-scoped upload/duplicate handlers through `useEditorConfig`; the shared editor serializes `image-component` nodes and its file plugins invoke delete/undo. Native `TaskRichEditor` currently disables images and is reused by unrelated entities. This checkpoint does not enable that component globally or claim browser parity.

Ordinary task description save now has an explicit image-aware content boundary. Shared `taskRichContent` still strips images for comments, intake edits, modules, stickies and other consumers. Attribute names and the persisted `UPLOADED` status derive from the existing editor contract, extracted without changing its values to `@plane/editor/image-contract`; existing `types.ts` imports continue through re-exports. `src`, `alt` and `title` are inherited Tiptap Image attributes. No raw remote image, storage ID, transient upload node or foreign-task asset is accepted.

Each distinct image is resolved through canonical ready-asset authorization, checked for the same task and an image MIME. The existing 100,000-character HTML limit remains; atomic validation allows up to100 distinct images to bound asset/ACL reads and rejects excess explicitly. Existing file size, MIME signature, digest, finalization, session, task/intake access, retention and byte delivery owners are reused. The new same-task duplicate action creates independent bytes through existing prepare/finalize and orphan cleanup. No new storage purpose/table/policy is introduced.

## Content concurrency and removal

No new revision column or backfill is needed. The newest `taskDescriptionVersions` identity plus its revision is the content token. Same-actor rolling-history writes advance its revision; a new history group changes its identity. Canonical task creation (including draft publication and intake submission), plain-description replacement, intake edit and history restoration all pass through `writeDescription` in their transaction. Opaque imported JSON/binary updates preserve the same canonical HTML and do not advance the content token. An absent history row is represented by null; the first actual content change creates a version and invalidates null drafts. A no-op is not a content change.

`description.get` adds `contentVersion`; `save` accepts `expectedContentVersion`. The currently deployed editor still supplies `expectedUpdatedAt`, retained only for the additive activation window. Supplying both or neither is rejected. After the native editor and its callers switch, remove the old argument/path. Attachment upload/removal advances the aggregate task timestamp but leaves content tokens valid; concurrent content edits still reject without replacing the draft.

Removing an image node only unlinks that reference in the atomic description save. It never retires bytes: saved history and other references can still own them. Cancel and rejected CAS perform no persisted reference or asset mutation. Explicit attachment removal remains the existing uploader/admin operation with seven-day recovery. History restoration revalidates current ready image bindings, so explicitly removed assets must be recovered through that owner first; expired or inaccessible bytes are not silently recreated.

## Verification and pending UI

Seven new behavior cases cover upload+content save, stale text rejection, reference unlink/history/bytes retention, malformed/foreign/remote/removed references, independent copies and revocation, plain replacement/archival, null-token concurrency, and transient image rejection (several cases combine these paths). Full backend suite:605 tests across98 files. Backend and editor native TypeScript checks and focused Oxc passed. Classic complexity max10 in existing `writeDescription`; bound validation max4 per callback. Cognitive review: one canonical content version owner, one image-binding boundary, no deletion queue or second revision table.

Pending frontend activation must reuse authenticated asset transfers and per-asset ordering, preserve captured content token, avoid calling destructive attachment removal on a local editor delete, enable images only for task-bound descriptions/history, and retain unrelated editor behavior. No browser image journey or remote deployment is claimed by this backend checkpoint.

## Native task-bound editor activation

`TaskDescriptionEditor` supplies the canonical task attachment resolver, upload/finalize and independent-copy action to the existing editor schema. It is keyed by task identity. Only this explicit consumer enables image nodes; unrelated `TaskRichEditor` callers remain image-free. Ordinary description editing captures `contentVersion`, retains local HTML through pending renders, and disables Save while image transfers finish. Read-only task history uses the same authorized image renderer.

The authenticated byte/URL reader was extracted from the document owner and the upload executor from existing file attachments. Document mutations retain their original lifecycle queue; task-local delete is intentionally non-destructive, and undo checks readiness rather than reviving an explicitly removed attachment. Shared transfers still own aborts and object-URL cleanup. Document uploads now use the same canonical empty-browser-MIME extension mapping already used by file attachments. No new upload protocol, MIME policy, URL credentials or asset cache was introduced.

Provenance review covered each extraction caller: document read/ordered delete/restore, file attachment upload, task editor and historical preview. Two added transfer behavior tests verify canonical MIME/body/finalization and cancellation before upload; all55 native frontend tests pass. Scoped Oxc passes; classic complexity is6 in the extracted reader callback,3 in the bound editor and1 in the upload executor. Browser upload/delete/undo/Cancel/stale-save and constrained-width acceptance remain root-owned pending checks.

The old aggregate `expectedUpdatedAt` save argument remains solely for active immutable local artifacts3025–3029. Remove it only after a fixed artifact using content tokens is verified and those agent-owned old consumers are retired. D13 separates existing intake metadata edits from task-bound description editing to avoid image stripping and same-form upload self-conflicts; its activation and tests are tracked independently.

## Content-token cutover after fixed-artifact acceptance

Root Chrome accepted fixed artifact1313b7fc28 on3030: upload decoded192×192 and saved; local removal/undo decoded again; removal/Cancel preserved saved content. D13 upload/save, priority edit and acceptance preserved image, estimate3 and label in the ordinary task. Root restored the original task text and recoverably removed the QA image; the D13 fixtureNSTAR9 and bridge were moved to Trash.

The five superseded local fixed servers were verified by listening PID, working directory and served build identity before targeted SIGTERM:3025/d330786578/PID39090,3026/ae84433f63/PID55429,3027/ba195cc17f/PID77574,3028/4d461b740f/PID90484,3029/31007cd926/PID8153. All five listeners disappeared. Their artifact directories remain. Dev3010, remote-backed3024, accepted3030 and temporary authenticated-site gateway3218 remained listening. No remote backend was changed;3024 continues its separate older backend contract.

The native description-save argument now requires `expectedContentVersion`; the additive `expectedUpdatedAt` branch and task-revision import were removed. Repository callers were enumerated: the current ordinary editor already sends the token, while description/history/draft publication tests were switched to the canonical description query token. Four focused suites/22 behaviors pass, including stale/null-token saves, image upload without self-conflict, historical restoration and draft publication. Backend TS7 and focused Oxc pass. Activation of this required contract remains a separate reviewed deployment step.
