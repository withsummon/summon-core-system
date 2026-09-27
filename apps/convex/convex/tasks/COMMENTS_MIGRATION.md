# Task comments: native bounded slice

## Legacy owner and retained rules

`plane/app/views/issue/comment.py:IssueCommentViewSet` lists comments for active project members. Create accepts admin/member/guest, but a guest without `guest_view_all_features` may comment only on their own issue. Edit/delete permits the creator or project administrator. `IssueComment` stores HTML/JSON/plain text, optional parent, attachments, internal/external publication scope and edited timestamp. Issue activity invokes notification delivery after create/edit/delete.

Native `tasks/comments.ts` reads the canonical task then current workspace/project ACL. Project members/admins create; a guest can create only on a task they authored. The native project currently has no configurable `guest_view_all_features`, so that configurable permission is not migrated. Authors and project administrators edit/delete after current ACL and comment revision checks. Read-only guests cannot moderate other authors. All comments are internal project content; no external publication endpoint exists. Legacy internal list likewise does not exclude INTERNAL comments from active project guests.

## Native public contract

- `access({taskId})` exposes the canonical create permission used by the composer.
- `create({taskId,html})` derives author from authenticated identity and uses the existing task rich-content sanitizer to persist sanitized HTML and derived plain text. Empty sanitized content rejects; input budget is 100,000 characters.
- `list({taskId,paginationOpts})` reads at most 50 rows/1 MiB, newest first. It returns generated comment rows plus authorName/canEdit and canCreate permissions. Cursor/isDone remains authoritative.
- `update({commentId,expectedUpdatedAt,html})` and `remove({commentId,expectedUpdatedAt})` require author or project admin and current revision. A sanitized identical update creates no new event. A changed update advances monotonic revision and editedAt.

Comment mutations reuse `notifications/delivery.ts:recordTaskEvent` in the same transaction. Task event kinds explicitly identify comment_created, comment_updated and comment_deleted, with optional commentId reference and current task status. No comment body is copied into events or notifications; deleted content is not recoverable through those surfaces. Deleted comment references in activity are historical identifiers, not live content promises. Existing explicit subscribers receive notifications with current ACL/actor exclusion; commenting does not subscribe everyone or implicitly subscribe its author. Task metadata revision is independent of comment revisions.

## Remaining contracts

No comment attachments/assets, reactions, reply threads, mention parsing/notification, email delivery, external comments/system actors, complete legacy before/after payloads or data migration. Existing Django comments remain. Native frontend comment composition/rendering now uses the shared task rich editor; browser acceptance is pending. Rich HTML is sanitized by the existing owner; use its output without reconstructing HTML from plain strings.

## Evidence

Five module-local BDD tests cover sanitizer/XSS removal, atomic typed notification delivery, no deleted-text payloads, author/admin versus ordinary member, guest own-task rule, revocation, CAS/no-op edits, invalid content, anonymous reads and bounded cursor traversal. Focused lint/complexity and native TypeScript checks pass. Parent reviews the shared taskEvents contract and frontend notification projection before commit.
