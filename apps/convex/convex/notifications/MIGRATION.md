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

## Inbox categories and bounded mark-read

`selection.ts` owns the shared inbox/list/batch predicate. Categories are an OR array; empty means all. Both request boundaries reject duplicates and more than three entries. Assigned uses current assignee IDs. Created requires current creator and non-guest workspace membership. Subscribed means a current subscription excluding created/assigned tasks. A guest's unavailable created category does not suppress another selected category. Current task ACL is checked for every projected or updated record.

`bulk.begin` freezes the view, mention selector, categories and server timestamp in a receiver-owned batch. `bulk.page` walks at most 50 candidates with a server-owned cursor, marks only currently unread matching authorized rows, and returns actual changed count/isDone. A strict creation-time cutoff excludes arrivals at or after the begin millisecond (existing notifications created in that same millisecond can remain unread intentionally). Snooze membership uses the captured time; task membership/assignees/subscriptions are rechecked per page. Concurrent mark-unread on an already visited page remains unread. Cancel is idempotent, completion is idempotent, and unfinished batches expire after 15 minutes. An hourly cleanup uses the by_now index to delete batches older than 24 hours, at most 100 per invocation with bounded scheduled continuation; current batches and completed retries within retention remain intact. Clients stop scheduling on unmount and can cancel explicitly; no automatic background completion occurs.

Inherited `app/views/notification/base.py` list and mark-all differ: list ORs comma categories and excludes creator/assignee from subscribed, while mark-all accepts singular watching and omits mention filtering. Its snooze predicates overlap and its subscribed assignee correlation uses the assignee primary key. Native intentionally shares the current coherent list predicate with bulk action, preserving future-snoozed versus expired-inbox behavior and avoiding those inconsistencies. The created guest restriction applies per category rather than erasing other OR categories. Existing single-notification read/unread remains available; arbitrary selected-ID bulk unread is not added.

Module BDD covers category transitions, combined OR selection, receiver ownership, new-arrival cutoff, cancellation, completion retry, post-begin revocation, pagination past 50 candidates and mention/archive parity. These source/tests do not establish deployment or browser acceptance.

## Account email-preference settings

`notifications.index.preferences` and `savePreferences` now own the five inherited account email settings: property changes, state changes, completion, comments and mentions. `notificationPreferences` indexes the authenticated app user; read defaults match `UserNotificationPreference` (all enabled), and the mutation uses the row revision to reject a concurrent stale save. The public API accepts no receiver ID. The preserved Account Settings notification controls consume its generated `settings` object directly; SWR, UserService and the duplicate optimistic form/reset state are removed.

These settings affect email decisions, not in-app delivery. Inherited `notification_task.py` checks state changes, completed-state changes, comments and property changes in that order, while mention email uses the mention flag independently. Native `recordTaskEvent` still inserts only in-app notifications and does not read these email preferences. Real email dispatch and browser acceptance remain open; persisting a toggle does not prove email-delivery parity.

## Native scheduled recipient and email delivery

Earlier sections record predecessor capacity and delivery limits. The event and native recipient-delivery schedule now commit together. Indexed per-user uniqueness replaces the historical total-subscriber cap; bounded scheduled mutations exhaust recipient cursors without truncating later subscribers. The actor and newly added assignees/mentions auto-subscribe, subject to current discussion/account authority. Self-subscription uses the same uniqueness owner; its generated UI has no cardinality-based permission flag. Recipient authority and email preferences are evaluated at asynchronous delivery, matching the inherited worker boundary.

Private comment text is stored once per event, alongside its delivery cursor/completion; public activity remains canonical. Thin email logs reference this snapshot and canonical selected field IDs, rather than copying actor/kind/changes/text per receiver. Five-minute receiver/task batches preserve actor grouping, the five preferences and newly-mentioned-only selection. Final current task/receiver/config authority precedes one direct provider attempt; unknown acknowledgements are terminal, with no automatic resend. Provider acceptance starts inherited seven-day retention; private content is released after its last accepted log, while pending/unconfirmed references remain. Completed events with no mail logs release their snapshot immediately.

Native scheduled mutations commit cursor advancement, recipient writes and the next continuation atomically; duplicate stale/completed callbacks are no-ops. Traversal across pages is asynchronous, not claimed as one historical subscriber snapshot. Native scheduler/OCC, actual role/provider/DNS/HTML/avatar acceptance and description/link/attachment mention parity remain separate gates. No legacy worker or route is retired by these source changes.
