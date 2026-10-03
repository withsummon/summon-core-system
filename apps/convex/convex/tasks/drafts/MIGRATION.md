# Native task drafts

## Owner and invariant

Inherited owner: `app/views/workspace/draft.py`, `app/serializers/draft.py`, `db/models/draft.py`. Draft list/retrieve/update are author-private; draft titles and project may be empty. Legacy publish lacks an author filter and delete permits workspace administrators. Native deliberately keeps every draft operation author-only, with current workspace/project membership, including administrators. Project archive/revocation hides associated drafts; restoration of access restores visibility. Native guest authors can maintain basic private drafts but publishing requires a current project/workspace writer. Parent selection requires the current native parent writer policy.

The new owner is `tasks/drafts`. Save uses captured contentRevision; remove, restore, publication and copy use aggregate updatedAt. File mutations advance only aggregate updatedAt so an open content editor remains valid while publication approvals become stale. Existing stored drafts were backfilled before making contentRevision required (receipt below). Project changes cannot carry invalid state, assignee, label, parent, cycle or module references; clients explicitly clear scoped selections. Title may remain blank until publish. HTML uses the existing sanitizer. All mutation failures preserve the draft.

Publishing runs in one transaction. `createPreparedTask` now owns ordinary creation and draft publication preparation, defaults and properties validation; existing `createTask` allocates task identity, sequence, initial description/history, subscription and event. Cycle/module public mutations and publication call the same extracted assignment functions. Parent and relation revisions are rechecked at publication. A retained publishedTaskId makes retries return the same task after current authorization, without another sequence/event/subscription. Published drafts are excluded from draft collections.

## Editor representations and retained scope

JSON and binary are opaque payloads, bounded to 100,000 JSON characters and 512 KiB binary. JSON uses shared boundedJson validation. Their original bytes are preserved through copy and publication by the canonical description owner and exposed by description.get. HTML changes clear stale JSON/binary unless explicit replacements accompany that draft save; ordinary task HTML/plain changes clear them too. No conversion, equivalence validation, JSON/binary editor rendering or historical representation roundtrip is claimed. Existing HTML/plain description history remains unchanged.

Parent, cycle and modules are included. Draft files use the asset scope and publication transfer described below. Estimates, issue types, external IDs, sort-order customization, import and legacy REST/PAT routes remain inherited. No old route is retired by this slice.

## Verification boundary

Module-local BDD covers author privacy (including other administrators), blank drafts, save CAS, copy/remove/recovery, guest publish denial, exactly-once publication and sequence/subscription ownership, opaque representation preservation/clearing, atomic parent/cycle/module publication with stale relation rejection, project move validation and post-revocation visibility. Full backend suite passed before the final project visibility test; final receipt is reported separately. Deployment and browser acceptance belong to the primary agent, not this source-only implementation.

## Draft attachment extension (awaiting browser/deployment acceptance)

`assets` now has a mutually exclusive draftId scope. Its canonical scope owner requires the draft author plus current workspace/project access and an active unpublished draft. Existing prepare/claim/commit MIME, size, digest, content validation and authenticated download are reused. Generic prepare/remove cannot bypass the draft lifecycle. File removal/restoration shares the extracted attachment revision/retention/byte-check owner with task attachments.

At publication, ready and removed assets are rebound to the created task/project in the same transaction, preserving uploader and bytes and advancing attachment revision. Pending uploads block publication and can be explicitly cancelled. Ready uploads and file lifecycle changes advance draft CAS, so an older publication confirmation cannot silently include new files. Private assets carry null projectId while the draft owner authorizes its current project; moving a draft cannot strand a stale asset project binding. Each draft permits 100 live reservations, ready files and recoverable removed files. Indexed status/expiry queries exclude rejected, cancelled and expired history from this capacity and from transfer. Existing MIME acceptance is unchanged.

Independent copying uses `tasks.drafts.copy.run`, replacing the old mutation. It snapshots source revision and live attachments, copies each ready blob sequentially into independent storage, then reauthorizes source and attachment revisions and validates byte size/hash/unclaimed storage in one destination transaction. Copy rejects pending uploads, excludes removed/cancelled/expired records, and caps total ready bytes at 32 MiB. Failed actions leave unclaimed blobs for the existing orphan sweep. Copy does not alias storage, so removal/cleanup of either copy cannot damage the other. A repeated explicit copy action creates another draft; no automatic retry is introduced by the UI.

Module tests prove private download, uploader preservation, finalized upload replay after publication, deleted-draft denial, file CAS, rollback after task insertion when pending uploads prevent publication, independent copied bytes, post-copy source conflict, content-versus-publication CAS, and capacity unaffected by closed attempts. Backend completion does not establish browser acceptance.

## Content revision migration receipt

Primary deployed the additive schema locally at 15:34:13. The bounded backfill processed three drafts and changed three, returning isDone=true. A verification pass processed the same three and changed zero, also isDone=true. Both passes enforced maxRows=100 and maxBytes=1,048,576. The migration only populated missing contentRevision=0; retained content and timestamps were unchanged. After this receipt, contentRevision is required and the temporary migration and missing-value guard are removed. The remote deployment has no prior draft schema, per primary deployment inventory, so its first draft schema includes this required field.
