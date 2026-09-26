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
