# Documents frontend slice

`/core` Documents uses the existing `@plane/editor` collaborative rich-text editor,
with a dedicated Convex-backed Hocuspocus endpoint. It does not mount the legacy
Django page editor/store wrapper.

## Owner trace

- Convex document metadata/get/context queries own visibility, editable state,
  lifecycle and selected detail. Lists use bounded pagination and continue when
  a page contains no visible rows but its cursor is not exhausted.
- The existing editor owns rich-text/Yjs behavior and rendering. Its public
  realtime configuration now accepts an explicit token provider and room name.
  Legacy consumers still use their existing JSON user token by default.
- The new live process owns Yjs merge, initial title seeding and snapshot/title
  persistence. The frontend never posts HTML-only saves or retries revisions.
- Metadata settings retain generator-owned view/logo properties, context links,
  external references and sort order. Existing names are edited through the
  collaborative heading, avoiding a competing metadata name writer.
- Document owners can lock/archive/delete. Current workspace guest status hides
  these controls. All mutations independently enforce backend authorization.

## Reconnection and recovery

The native shared hook previously reopened forced-closed connections on focus or
online events. Forced-close state now remains terminal until a new session.
Fresh JWTs are read through a stable callback, so credential refresh does not
replace the in-memory Y.Doc.

Convex rooms disable automatic IndexedDB replay. A rejected shared Y.Doc can
contain updates from another writer; replaying that document under a fresh user
identity would violate the live owner's failure boundary. After a disconnect or
save failure the in-memory copy can be downloaded as recovery JSON. Reopening
loads durable server state. This is not a full offline editing implementation,
and navigating away without exporting an unsaved copy can lose local changes.

## Verification and remaining scope

The native editor build passes; focused editor/document lint and document
complexity checks pass. Main-run Chrome acceptance owns rendered editor, two-user
collaboration, lock/unlock and refresh verification. Backend/live tests separately
verify ACLs, CAS conflicts, title seeding and rejection recovery.

AI editor actions and issue embeds remain disabled. Mentions, hierarchy, historical-version restore,
version UI, sharing dialogs and all legacy page navigation are not migrated.
No Django/live-service retirement or full document parity is claimed here.

## Primary Chrome acceptance

Two independent sessions (127.0.0.1 and localhost on port 3010) opened the same workspace document. Owner text persisted into the peer editor; peer edits appeared in the owner without reload. Locking switched both editors to read-only; DOM verification showed both title and content contenteditable=false. Unlock restored editing. Renaming the title followed by immediate deep-link reload retained the title and shared body. Switching visibility to private removed the peer's content immediately; review then localized the unavailable-document boundary so it does not claim the whole workspace is inaccessible. Chrome readback of the denied deep link then confirmed the document-specific message and Back to documents while retaining all workspace navigation.

Desktop and 390×844 editor screenshots were inspected. Title and content have explicit accessible textbox names. That browser acceptance preceded the asset integration below. Offline IndexedDB replay remains disabled; recovery is an explicit local download rather than silent replay of rejected writes. Shared presence across multiple live server processes is still unverified.

## Authenticated document assets

The existing image uploader is now connected to Convex assets. File limits and MIME choices come from the backend policy query. Uploads carry a SHA-256 digest, finalize only after server validation, and persist canonical asset IDs into the existing image node. Raw upload storage references are checked as strings and normalized at the backend owner.

Image reads resolve IDs against the active document, then request the HTTP site with an Authorization header. Credentials are never placed in image URLs. The editor receives blob URLs; leaving the document aborts pending requests, prevents late results from creating URLs, and revokes existing URLs. Downloads use separate attachment blobs. The candidate environment must configure `VITE_CONVEX_SITE_URL` alongside the Convex API and live URLs.

Deleting an editor image uses the backend's seven-day reversible deletion; undo restores it after fresh ACL/lock checks. Duplication copies bytes into an independent asset in the same document. Cross-document copies are not supported by this slice. The generic handler supports the server's restricted file formats, but this existing editor exposes image upload UI; there is no new generic attachment block UI here.

Four module-local behavior tests cover URL teardown, late-response cancellation, a fresh transfer after cancellation, and malformed upload responses. Native web types and focused lint pass. Real browser image upload/render/undo/download acceptance is a separate primary-agent gate, not implied by these checks.

Image undo review found a shared editor assumption: private image IDs skipped the restoration tracker and relied on a DOM image error. Authenticated ID resolution can reject before any image URL exists. The tracker now restores explicitly deleted assets regardless of URL format. Native handlers order each asset’s deletion, undo, and subsequent source resolution. Three additional behavior tests cover immediate undo ordering, failed deletion followed by explicit restoration, and independent assets. The primary browser undo and reload checks after rebuilding the editor are recorded below.

Primary Chrome repeated the exact undo journey after the fix: a fresh image upload followed immediately by Backspace and Command+Z restored a rendered blob image (192-pixel image readback). The older image deleted before the fix remained unavailable, consistent with its previously soft-deleted asset. Subsequent primary Chrome reload also retained the restored image; this is a separate persisted readback from the immediate undo result. The primary run executed all ten document-asset and assistant transport tests successfully.

### Settings concurrency correction

Metadata forms now retain their opening document/version, and metadata and lifecycle mutations reject stale `expectedUpdatedAt`. Snapshot saves continue using their existing revision CAS while also advancing the settings version monotonically. A conflicting save keeps the user's form draft and asks them to reopen the latest settings; no automatic retry can overwrite another writer's visibility, title, lock, or archive change. Backend behavior coverage includes these conflicts and same-millisecond writes.

## Recovery and concurrent metadata acceptance (2026-09-27)

Chrome at `127.0.0.1:3010` created a synthetic private document with persisted editor content, soft-deleted it, found it in owner Trash, restored it, and reopened the same content/private visibility. Trash became empty after restoration. Three module tests independently cover retained binary revisions and lock/archive state, another administrator's exclusion, stale restores and current membership revocation.

In two owner tabs, the first kept a settings draft while the second renamed the document. Saving the stale draft produced the expected conflict message, retained the category input, and preserved the current title. Reopening settings and saving against the new version succeeded. The live two-user network suite also passed after the version-contract deployment: bidirectional editing, durable merged HTML, title synchronization, locked-write rejection, revocation and eviction of rejected room bytes. This is local runtime evidence, not remote deployment acceptance.
