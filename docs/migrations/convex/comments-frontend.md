# Native task comments UI

Task detail lazy-loads `tasks/comments.tsx`. The existing description editor configuration moved to `tasks/rich-editor.tsx:TaskRichEditor`, shared by descriptions and comments; unsupported image/AI/embed/mention capabilities retain the existing configuration. No HTML serializer or parallel editor policy was introduced.

The composer uses generated `comments.access.canCreate`; each row uses generated `canEdit`. Readonly content renders through the existing editor. The edit form captures its original revision and HTML once, keeps local draft on mutation failure, and warns when reactive remote content changes. It does not substitute a new server revision into the old draft. Cancelling is an explicit discard; errors preserve the draft. Task selection keys reset the module lifetime.

Delete uses an inline permanent-deletion confirmation with the selected revision captured when opened. A concurrent edit makes delete fail rather than removing revised content. Native comment deletion is permanent and has no restore/trash. Legacy comments inherit SoftDeleteModel and soft-delete by default; deletion/recovery parity is therefore still unresolved. The task boundary handles permission-loss query errors. Pagination exposes loading/empty/load-older states; loaded count is not advertised as a total.

Verification: native web/backend types, focused Oxc lint/complexity and backend comment behavior tests pass. The backend test includes the same permission projection used by the composer. There is no pure frontend transformation requiring a mirrored unit test. Parent-owned Chrome acceptance must still exercise rich create/edit, stale-draft recovery, delete confirmation and narrow layout before visual completion.

## Primary Chrome acceptance

The owner created and edited a synthetic comment on NSTAR-2. The separate project-guest session observed both values live, displayed a read-only editor, and had no author edit controls. Recipient notification delivery and navigation back to that task passed. Permanent deletion was not performed in Chrome; backend tests cover its authorization, revision conflict and removal.
