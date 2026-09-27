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
