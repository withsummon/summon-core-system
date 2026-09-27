# Personal project ordering migration

## Owner and invariant

`projectUserProperties` is the canonical private `(project,user)` owner. The initial slice contains only derived workspaceId, integer sortOrder and revision; future personal navigation fields belong here, not a second JSON store. `projects/order_owner` allocates a new member's project at the current minimum minus 10000 (first 65535). Existing rows survive revoke/rejoin unchanged. Canonical project creation and project membership grants call this initializer, including invitations and commercial project creation through those owners.

No public API accepts another user or an arbitrary numeric order. `projects/order.list` verifies current workspace membership, queries the current user's indexed order and projects only active same-workspace project membership and nonarchived projects. It preserves sparse pagination (1–100 items, 100 database rows/1 MiB read cap). Projection returns the established project fields/roles plus `orderRevision`.

`projects/order.move` accepts project ID, captured current and neighbor revisions, neighbor project ID and up/down. It requires current project access, checks both revisions, and recomputes the nearest currently visible neighbor before atomically swapping their owner-issued integer positions. This prevents applying an old neighbor decision after reorder, archive or revocation. Hidden project names are never returned. Neighbor lookup scans at most 200 indexed rows and errors if the boundary cannot be determined; it never calls a partial scan a first/last position. Duplicate/invalid numeric positions are an explicit invariant error. Numeric allocation exhaustion rolls back project/member creation instead of persisting an unorderable row.

## Additive rollout (current stage)

1. Deploy this additive backend to both hosts. Existing `projects.index.list` and current native chooser are unchanged; absence of old property rows cannot break them. New create/grant writes initialize the new owner.
2. Run every cursor page of internal `projects/order:backfill` on each host. It scans 50 memberships/1 MiB per transaction, including inactive membership history, verifies project/workspace consistency, and sequentially initializes only absent rows. Sequential insertion is necessary because each allocated position reads the preceding insert. Receipt contains processed, changed, cursor and isDone.
3. Repeat complete scans on both hosts and retain zero-change receipts. Concurrent new memberships use the new initializer; repeat scans cover existing state. No dual-write order or destructive migration is involved. Old native ordering was not user-customizable, so historical rows get deterministic creation-order prepend initialization rather than invented historical user choices.
4. Only after both receipts: activate the real ordered project chooser and enforce initialized owner where the consumer requires it. Remove temporary backfill and migration-specific test after proof; retain meaningful uniqueness/privacy/CAS tests. There is no optional row field to tighten, but existence of a corresponding private row becomes the canonical membership invariant at cutover.

No deployment or backfill has been performed for this slice at this receipt stage. Django routes remain registered. User-preference metadata alone is not a route cutover.

## Verification and remaining scope

Seven module-owned behavior tests cover new prepend ordering, both revision checks/adjacency, guest-private order and owner isolation, revocation/rejoin retention, archived sparse pages and restored position, repeatable backfill including inactive membership, duplicate/integer exhaustion rollback, concurrent creation, and explicit 200-row neighbor overflow. TypeScript 7, scoped Oxc and new owner complexity checks are separate gates. Actual chooser and browser acceptance await cutover.

The exact inherited owners/routes and consumer evidence are in `PERSONAL_PREFERENCES_PLAN.md`. ProjectMember's separately registered views/default props and member-targeted preferences are not silently aliased. Navigation defaults/hidden tabs, page block layout, task filters/rich expressions, grouping/order/layout/display properties remain further native work. No full project preferences parity is claimed.
