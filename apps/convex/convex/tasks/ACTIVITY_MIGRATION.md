# Task activity read owner

Existing task mutations and notification delivery own immutable taskEvents.
The native detail lacked a reader for these records. The new activity query
uses the indexed task stream and canonical requireTask read permission on every
page, including guest ownership, archived reads, trash exclusion and revoked
memberships. It exposes display name only, never actor email/auth data or comment
body. Pagination uses the existing bounded pageBudget owner.

The view subscribes only after Show activity, and unmounts when closed. It renders
stored event kinds; historical generic updates have no fabricated before/after
values. There is no duplicate event storage or inferred history. Tests exercise
creation/status continuation, minimal identity projection, page bounds and current
access changes. This is a native activity reader, not full inherited activity
parity: field diffs and complete producer coverage still require migration.
