# Task property activity

The existing `taskEvents` record and transactional notification delivery remain the single event owner. `taskChanged` compares the captured pre-write task with the current document, writes its monotonic revision, then emits one event. Single/bulk property changes, status changes and intake acceptance use that owner; existing intake edits, label retirement and estimate remapping inherit it. All existing callers were traced: they invoke the owner after their property or relationship write. Label/estimate cleanup captures values before deleting referenced taxonomy.

Optional typed `changes` store title, priority, state/status, dates, assignee/label additions/removals, and estimate before/after values. Values are immutable task audit snapshots; no email, credentials or description body is copied. Set reordering does not create a delta. Existing coarse events have no reconstructable before values and remain explicitly coarse (`changes: null` at the read boundary); there is no invented backfill. Unchanged saves retain their existing coarse update-event behavior with an empty changes array.

Activity reads still use current canonical task access, including guest ownership, membership revocation and trash denial. Names captured while the mutation was authorized remain task-owned historical audit content after member/taxonomy rename or deletion. The read never enriches these snapshots from an unrelated project's current metadata. Notification delivery continues to check current recipient task access and emits once per mutation, not once per changed field.

BDD covers all property shapes, immutable values after rename/deletion, stale-CAS no-event rollback, bulk additive/no-op sets, status/custom-state clearing, label retirement, coarse historical creation, pagination and existing guest/revocation/trash restrictions. Broader activity parity for descriptions, parent/relations, attachments and lifecycle remains separate; those existing updates retain coarse events. No deployment or browser acceptance is implied by these tests.

## Local activation

Backend `c2d602a82f` passed586 backend tests, native TypeScript7, scoped Oxc and exact-archive TypeScript checks. It was activated locally as an ancestor of the authentication experiment `168a441677`; the auth deployment log confirms finalization at `http://127.0.0.1:3210`. No separate older activity archive was pushed, and compatible OIDC was subsequently restored in `51cd46a788`. The existing activity panel now renders generated typed deltas beneath each event, retaining its original coarse rendering for historical rows. Remote activation remains unverified for this slice.

## Chrome acceptance — 2026-09-27

Fixed production frontend `4d461b740f3503da73659300ac73a53c33c785c9` at `http://127.0.0.1:3028/core` uses the temporary diagnostic HTTP gateway documented in `local-jwt-site-proxy.md`. On NSTAR-7, changing High to Medium showed `Priority: high → medium` in the existing activity panel. Restoring High added `Priority: medium → high` while retaining the first snapshot. Ready for QA, estimate 1, labels, unassigned ownership and dates remained unchanged. Historical events retained their coarse text. This proves one property journey in Chrome; other property shapes and access denial are covered by the owner BDD, not claimed as browser-tested.
