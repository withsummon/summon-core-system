# Task comments: native bounded slice

## Legacy owner and retained rules

`plane/app/views/issue/comment.py:IssueCommentViewSet` lists comments for active project members. Create accepts admin/member/guest, but a guest without `guest_view_all_features` may comment only on their own issue. Edit/delete permits the creator or project administrator. `IssueComment` stores HTML/JSON/plain text, optional parent, attachments, internal/external publication scope and edited timestamp. Issue activity invokes notification delivery after create/edit/delete.

Native `tasks/comments.ts` reads the canonical task then current workspace/project ACL. Project members/admins create; a guest can create only on a task they authored. The native project currently has no configurable `guest_view_all_features`, so that configurable permission is not migrated. Authors and project administrators edit/delete/restore after current ACL and comment revision checks. Read-only guests cannot moderate other authors. All comments are internal project content; no external publication endpoint exists. Legacy internal list likewise does not exclude INTERNAL comments from active project guests.

## Native public contract

- `access({taskId})` exposes the canonical create permission used by the composer.
- `create({taskId,html})` derives author from authenticated identity and uses the existing task rich-content sanitizer to persist sanitized HTML and derived plain text. Empty sanitized content rejects; input budget is 100,000 characters.
- `list({taskId,deleted?,paginationOpts})` reads at most 50 rows/1 MiB, newest first. It filters active comments by default; deleted mode exposes preserved records only to their author or current project administrators. It returns generated comment rows plus authorName/canEdit/canRestore and canCreate permissions. Cursor/isDone remains authoritative.
- `update({commentId,expectedUpdatedAt,html})`, `remove({commentId,expectedUpdatedAt})`, and `restore({commentId,expectedUpdatedAt})` require author or project admin and current revision. A sanitized identical update creates no new event. A changed update advances monotonic revision and editedAt.

Comment mutations reuse `notifications/delivery.ts:recordTaskEvent` in the same transaction. Task event kinds explicitly identify comment_created, comment_updated, comment_deleted, and comment_restored, with optional commentId reference and current task status. No comment body is copied into events or notifications; deleted content is not recoverable through those surfaces. Deleted comment references in activity are historical identifiers, not live content promises. Existing explicit subscribers receive notifications with current ACL/actor exclusion; commenting does not subscribe everyone or implicitly subscribe its author. Task metadata revision is independent of comment revisions.

## Remaining contracts

No comment attachments/assets, reactions, reply threads, mention parsing/notification, email delivery, external comments/system actors, complete legacy before/after payloads or data migration. Existing Django comments remain. Native frontend comment composition/rendering now uses the shared task rich editor; browser acceptance is pending. Rich HTML is sanitized by the existing owner; use its output without reconstructing HTML from plain strings.

## Evidence

Eight module-local BDD tests cover sanitizer/XSS removal, atomic typed notification delivery, no deleted-text payloads, author/admin versus ordinary member, guest own-task rule, revocation, CAS/no-op edits, invalid content, anonymous reads and bounded cursor traversal. Focused lint/complexity and native TypeScript checks pass. Parent reviews the shared taskEvents contract and frontend notification projection before commit.

## Reversible deletion boundary

Legacy `IssueCommentViewSet.destroy` calls `issue_comment.delete()`; its inherited
`SoftDeleteModel.delete(soft=True)` sets `deleted_at` and retains the record. No
comment-specific restore endpoint/UI was found in the inspected legacy owners.
The former native `ctx.db.delete` and permanent-delete confirmation violated the
retention boundary. Native remove now sets `deletedAt` and advances `updatedAt`,
without changing body, author, or edited timestamp. There is no native purge API.

The native deleted-comments disclosure adds explicit recovery. Restore uses the
same current task/workspace/project ACL, author-or-project-admin rule, state check,
and captured revision as edit/delete. It clears deletedAt, retains the same ID and
content, advances the revision, and records one body-free restoration event through
the existing atomic notification owner. Repeated or stale transitions cannot emit
duplicate events. Deleted comments cannot be edited until restored.

`deletedAt` is optional only because existing deployed native comments lack it;
absence means active. New writes always persist null or a timestamp. This stored
data transition may be tightened only after a bounded backfill and an absence
check. Pagination filters bounded candidates and keeps continuation metadata; a
page may be empty while older accessible comments remain. Previously hard-deleted
records cannot be recovered by this change.

Additional tests prove retained content/identity, restoration events and recipient
exclusion, stale restore rejection, non-author trash privacy, administrator recovery,
revoked author denial, filtered cursor traversal, and pre-lifecycle row compatibility.

## Primary recovery acceptance

The 08:09:05 local deployment was exercised in Chrome on NSTAR-1. The owner created a synthetic comment, retained a separate unsaved composer draft, moved the comment to deleted comments, and opened recovery without losing that draft. A connected project guest saw neither the deleted body nor a restore action. The owner restored the comment; both clients received the original text, and a full owner-page reload retained it. Compact 390px inspection showed readable content and recovery controls. The temporary viewport override was reset and the synthetic unsaved draft was cancelled after retention was verified.

Primary source review checked current task ACL, author/admin recovery, monotonic revision checks, cursor-preserving filtered pages and existing notification event ownership. The integrated backend suite passed 250 tests in 29 files; the agent's focused 14 comment/notification tests and native backend/web checks passed. No permanent purge or remote acceptance is claimed.
