# Recipient notifications frontend

## Scope and ownership

The native Notifications module uses recipient-owned notifications, not a workspace activity feed. It offers inbox, snoozed, and archived views; unread filtering; read/unread; archive/unarchive; a future snooze time; and canonical task navigation. Task detail exposes Subscribe/Unsubscribe for authorized readers, including guests. Existing task writers remain separately authorized.

Generated APIs own recipient access, current project membership, event kind, and persisted inbox state. The UI uses explicit labels for created, updated, status-changed, and comment-created/edited/deleted events. Task navigation resolves a project identifier from the existing authorized project list; no URL ID casts or extra per-row detail subscriptions are introduced. Opening an unread notification marks it read before navigation, and failed actions preserve the current screen with an error.

Filtered pages can be empty with a continuation. The UI keeps Load more available and only shows an empty state after exhaustion. It exposes no total or unread-count badge. The explicit caller clock refreshes every 30 seconds while visible, and on focus/visibility changes, so snooze expiry is reflected within that refresh interval rather than claiming exact scheduled delivery. Automatic clock refresh pauses while browsing additional pages or focusing a row action, so it cannot collapse loaded history or interrupt snooze input. Refresh notifications explicitly returns to the current first page; the paused state is labeled. Exact server-scheduled wake-up remains outside this bounded slice.

## UI and acceptance

The existing notification view/filter/list workflow remains the foundation. Actions stay with their recipient row and wrap at narrow widths. Canonical task detail remains the destination; this slice does not reproduce the legacy peek panel. Archived and snoozed state remain distinct: Unarchive does not falsely promise Inbox when a future snooze still applies.

Backend behavior tests cover delivery, actor exclusion, recipient isolation, revocation, page budgets, archive precedence, and snooze expiry. Focused frontend lint passes; final native typecheck and two-user browser acceptance are recorded by the primary migration run. No email delivery, mention extraction, full legacy filtering, assignment subscription policy, batch mark-read, or existing Django notification migration is claimed.

## Primary Chrome readback

A separately authenticated project guest subscribed to NSTAR-2. An owner comment appeared live in that guest's read-only task view and generated one recipient notification. Mark read, Archive, Unarchive, Snooze until the next day, Clear snooze, and opening the canonical task all succeeded. The actor was excluded from delivery by the backend behavior suite. Current access revocation is tested at the backend; this receipt does not claim a new browser revocation run for notifications.
