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

File uploads, AI editor actions and issue embeds are disabled in this slice.
Their existing editor interface explicitly rejects unavailable attachment
operations rather than writing to Django. Mentions, hierarchy, page restore,
version UI, sharing dialogs and all legacy page navigation are not migrated.
No Django/live-service retirement or full document parity is claimed here.

## Primary Chrome acceptance

Two independent sessions (127.0.0.1 and localhost on port 3010) opened the same workspace document. Owner text persisted into the peer editor; peer edits appeared in the owner without reload. Locking switched both editors to read-only; DOM verification showed both title and content contenteditable=false. Unlock restored editing. Renaming the title followed by immediate deep-link reload retained the title and shared body. Switching visibility to private removed the peer's content immediately; review then localized the unavailable-document boundary so it does not claim the whole workspace is inaccessible. Chrome readback of the denied deep link then confirmed the document-specific message and Back to documents while retaining all workspace navigation.

Desktop and 390×844 editor screenshots were inspected. Title and content have explicit accessible textbox names. File attachments and offline IndexedDB replay remain disabled in this slice; recovery is an explicit local download rather than silent replay of rejected writes. Shared presence across multiple live server processes is still unverified.
