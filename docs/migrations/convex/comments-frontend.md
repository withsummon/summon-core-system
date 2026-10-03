# Native task comments UI

Task detail lazy-loads `tasks/comments.tsx`. The existing description editor configuration moved to `tasks/rich-editor.tsx:TaskRichEditor`, shared by descriptions and comments; unsupported image/AI/embed/mention capabilities retain the existing configuration. No HTML serializer or parallel editor policy was introduced.

The composer uses generated `comments.access.canCreate`; each row uses generated `canEdit`. Readonly content renders through the existing editor. The edit form captures its original revision and HTML once, keeps local draft on mutation failure, and warns when reactive remote content changes. It does not substitute a new server revision into the old draft. Cancelling is an explicit discard; errors preserve the draft. Task selection keys reset the module lifetime.

Delete now uses an inline reversible-deletion confirmation with the selected revision captured when opened. A concurrent edit makes deletion fail rather than removing revised content. The native owner preserves the body and identity; “Show deleted comments” reveals a separate, paginated recovery section for the author or project administrators. Restore returns the same comment to the discussion. Opening recovery keeps active comment forms mounted, preserving unrelated drafts. No permanent-delete UI remains.

The task boundary still handles permission-loss query errors. Pagination exposes loading/empty/load-more states, preserves filtered-page cursors, and does not advertise a loaded count as a total. Legacy record retention is preserved; native explicit recovery is an added workflow because no comment-specific legacy recovery endpoint was found.

Verification: native web/backend types, focused Oxc lint/complexity and backend comment behavior tests pass. The backend test includes the same permission projection used by the composer. There is no pure frontend transformation requiring a mirrored unit test. Parent-owned Chrome acceptance must still exercise rich create/edit, stale-draft recovery, delete confirmation and narrow layout before visual completion.

## Primary Chrome acceptance

The owner created and edited a synthetic comment on NSTAR-2. The separate project-guest session observed both values live, displayed a read-only editor, and had no author edit controls. Recipient notification delivery and navigation back to that task passed. Permanent deletion was not performed in Chrome. The reversible-deletion update has not yet been deployed or exercised in Chrome.

## Recovery acceptance steps after coordinated deployment

1. Create a synthetic rich comment as its author, open delete confirmation, then
   move it to deleted comments. Confirm it disappears from the discussion.
2. Expand deleted comments, inspect the preserved rich content, and restore it.
   Confirm the same comment returns with its original body and author.
3. In another member session, confirm deleted comments by other authors are absent
   and restore controls are unavailable; project administrators can recover them.
4. Open an edit draft, expand recovery, and verify the draft stays intact. In two
   sessions, verify a concurrent change causes a revision conflict rather than
   silently deleting/restoring a different state.
5. Verify recipient restoration notification and task navigation, then inspect
   discussion/recovery controls at desktop and narrow widths.

## Primary recovery acceptance

The 08:09:05 local deployment was exercised in Chrome on NSTAR-1. The owner created a synthetic comment, retained a separate unsaved composer draft, moved the comment to deleted comments, and opened recovery without losing that draft. A connected project guest saw neither the deleted body nor a restore action. The owner restored the comment; both clients received the original text, and a full owner-page reload retained it. Compact 390px inspection showed readable content and recovery controls. The temporary viewport override was reset and the synthetic unsaved draft was cancelled after retention was verified.

Primary source review checked current task ACL, author/admin recovery, monotonic revision checks, cursor-preserving filtered pages and existing notification event ownership. The integrated backend suite passed 250 tests in 29 files; the agent's focused 14 comment/notification tests and native backend/web checks passed. No permanent purge or remote acceptance is claimed.
