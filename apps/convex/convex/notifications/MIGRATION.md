# Recipient task notifications

## Owner and invariant

Legacy `plane/bgtasks/notification_task.py` creates recipient-owned issue notifications from issue activity, subscriptions and mentions; the notification model/view and workspace notification service/store own inbox state. This native slice retains that recipient boundary. It is not a workspace activity feed.

`tasks/revision.ts`, `tasks/status.ts` and task create/update call `notifications/delivery.ts:recordTaskEvent`. The task change, event and recipient records commit atomically. Explicit subscribers receive one record per event, excluding its actor and anyone without current workspace/project membership. Task creators start subscribed and can unsubscribe. Other users explicitly subscribe; assignment-based auto-subscription and existing legacy subscriber migration remain unimplemented. Subscriptions cap at 100 per task so delivery never silently truncates an accepted subscription set.

Reads and inbox mutations enforce recipient identity and current project/workspace access. Revocation hides existing records and blocks new delivery. Archived projects are inaccessible. Read-only project guests may manage their own subscription/inbox, without task-write permission.

## Public API and pagination

`subscribe({taskId,subscribed})`, `subscription({taskId})`, `list({workspaceId,view,unreadOnly,now,paginationOpts})`, and `update({notificationId,change})` use generated contracts. Views are inbox, archived and snoozed. A non-null archive wins; a future snooze is snoozed; expired/null snooze returns to inbox. `now` is an explicit caller clock (not an authorization input); the consuming UI must refresh this value when a snooze expires. Mutations validate future snooze deadlines within one year.

List reads at most 100 candidate records/1 MiB then filters current ACL and view. Empty pages may have a continuation cursor. Clients must continue until `isDone`; page length is never a total/unread count. No total badge or unbounded mark-all-read endpoint is provided. Snooze semantics intentionally resolve inconsistent legacy list/count predicates rather than copying those bugs.

## Boundaries remaining

Comments, mention extraction/diffing, mention-only inbox, email preferences/delivery logs, assignment subscription policy, subscribed/assigned/created filter parity, batch mark-read and legacy record migration are not implemented. The existing Django owner remains. Native event payloads currently describe task kind/status, not the complete legacy before/after issue-activity payload. Generic task updates (including native description revisions) produce a generic updated event; legacy description-only events were suppressed except mentions. Native frontend inbox and actual two-user browser notification acceptance remain pending.

## Verification

Module behavior tests exercise duplicate subscription/no-op status, actor exclusion, unsubscribe, recipient isolation, read/unread, snooze expiry, archive precedence, revocation before delivery/read/write, bounded filtered empty-page cursors, invalid page budgets, anonymous access, subscriber cap and stale-write rollback. Existing task suite also runs against the shared event owner.

## Comment mentions and subscription closure

Comment create/update accepts an explicit typed `mentionedUserIds` list (maximum 20 distinct recipients), alongside sanitized HTML. This is a structured mention picker, not inline mention-node parsing. Existing comments lacking the optional field mean no historical mentions; omitted update arguments preserve existing mentions. Each submitted recipient must currently have task access, including the guest creator/view-all restriction. The choices endpoint uses that same predicate and bounded pagination. Mention removal never unsubscribes a user implicitly.

The existing event/delivery transaction remains the sole bus. Newly added mentions auto-subscribe via `subscriptions.addSubscribers` and receive one `isMention` notification; subscriber and mention roles deduplicate, actor is excluded. Unchanged mentions on later edits receive ordinary subscribed-comment notifications. Delete/restore do not re-send mention alerts. A100-subscriber cap fails the whole comment mutation when new mention subscriptions do not fit; there is no silent notification truncation. `isMention` absent on old notification rows projects false, a stored-data compatibility contract removable after explicit backfill/schema tightening.

`notifications.index.list` supports optional mentionsOnly with the same sparse-page cursors. `subscriptionAccess` exposes self-subscription capabilities. Archived tasks permit self-unsubscribe while new subscriptions remain disabled. No API accepts another user as the subscription owner. Existing task creator initialization remains; general actor/assignee auto-subscription parity remains staged.

`tasks.comments.get` binds a notification comment identifier to the current task and current ACL; removed comments cannot be read through this deep-link endpoint. No notification payload copies comment HTML or mentioned names. Existing notification history and mention eligibility use the same canonical current task visibility predicate. No email is sent: legacy UserNotificationPreference fields control email decisions (notification_task.py send_email and preference.mention), while its in-app insertion remains independent. Email preference UI, email delivery, push, legacy HTML mention tags, description mentions, reaction events, arbitrary subscriber roster management and bulk inbox actions remain out of scope. Legacy routes stay registered.

Module-local mentions tests cover deduplication, actor exclusion, subscriptions, edit diffs, mention-only filtering, guest target rejection/choice filtering, atomic capacity rollback, stale edit rollback, comment deep-link scope/deletion and archived self-unsubscribe. Backend gates do not establish deployed/browser completion.

## Guest task visibility closure

`tasks/access.ts` owns the shared creator/view-all predicate. Active workspace and project membership remain required, including for administrators. A guest in either scope may read their own tasks; other creators’ tasks require the project guestViewAllFeatures flag. Direct detail, descriptions, comments, attachments, subscriptions, notification delivery/inbox, project/workspace lists, reports, graph projections, cycle/module task rows and meeting task projections reuse this owner. Recovery retains its explicit creator/project-admin policy; archived tasks remain read-only. Intake keeps its separate bridge visibility until acceptance, after which ordinary task visibility applies.

Inherited evidence is the guest filter in `app/views/issue/base.py` detail/list and the creator/view-all comment creation guard in `app/views/issue/comment.py`. Native previously omitted this restriction from ordinary direct task reads. Existing attachment guest fixtures now explicitly enable view-all when they test guest uploads on another creator’s task; intake acceptance tests assert that a different guest loses access when ordinary task visibility applies. The cross-owner guest behavior test covers detail, description, comment, attachment, notification, project list, reporting and graph reads plus flag changes. This closes current native owners, not every inherited route or unmigrated producer.
