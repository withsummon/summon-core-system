# Personal project ordering migration

## Owner and invariant

`projectUserProperties` is the canonical private `(project,user)` owner. The initial slice contains only derived workspaceId, integer sortOrder and revision; future personal navigation fields belong here, not a second JSON store. `projects/order_owner` allocates a new member's project at the current minimum minus 10000 (first 65535). Existing rows survive revoke/rejoin unchanged. Canonical project creation and project membership grants call this initializer, including invitations and commercial project creation through those owners.

No public API accepts another user or an arbitrary numeric order. `projects/order.list` verifies current workspace membership, queries the current user's indexed order and projects only active same-workspace project membership and nonarchived, undeleted projects. The existing stream owner applies this proof before pagination (1–100 eligible items, 100 database rows/1 MiB read cap). A raw read cap can still yield an empty nonfinal page; consumers must retain its continuation. Projection returns the established project fields/roles plus `orderRevision`.

`projects/order.move` accepts project ID, captured current and neighbor revisions, neighbor project ID and up/down. It requires current project access, checks both revisions, and recomputes the nearest currently visible neighbor before atomically swapping their owner-issued integer positions. This prevents applying an old neighbor decision after reorder, archive or revocation. Hidden project names are never returned. Neighbor lookup scans at most 200 indexed rows and errors if the boundary cannot be determined; it never calls a partial scan a first/last position. Duplicate/invalid numeric positions are an explicit invariant error. Numeric allocation exhaustion rolls back project/member creation instead of persisting an unorderable row.

## Per-deployment rollout

1. Deploy the additive backend before activating an ordered consumer on that deployment. Existing `projects.index.list` does not require old property rows. New create/grant writes initialize the canonical owner.
2. Run every cursor page of internal `projects/order:backfill` where coverage is incomplete. It scans 50 memberships/1 MiB per transaction, including inactive membership history, verifies project/workspace consistency, and sequentially initializes only absent rows. Sequential insertion is necessary because each allocated position reads the preceding insert. Receipt contains processed, changed, cursor and isDone.
3. Repeat complete scans and retain zero-change receipts, then independently verify that every current active joined project has its same-workspace private order row. Concurrent new memberships use the initializer. No dual-write order or destructive migration is involved. Old native ordering was not user-customizable, so historical rows get deterministic creation-order prepend initialization rather than invented historical user choices.
4. Only after that deployment's coverage proof: activate its ordered consumer. Local proof does not activate a remote consumer. Remove the temporary backfill after all deployment receipts; no runtime guessed ordering or missing-row fallback substitutes for coverage. There is no optional row field to tighten, but existence of a corresponding private row becomes the canonical membership invariant at cutover.

Historical additive commit `cd4d5f5d85` passed exact-archive TypeScript 7 and deployed locally. Its complete local backfill processed 21 memberships and inserted 21 rows; the second complete pass processed 21 and inserted zero. Durable receipt: `docs/migrations/convex/checkpoints/project-order-backfill.json`. This historical cohort is not current local coverage proof. Remote backfill and remote ordered-consumer activation remain pending. User-preference metadata alone is not a route cutover.

## Preserved Project Settings entry candidate

The existing `/:workspaceSlug/settings/projects` entry preserves the inherited redirect to the first joined active project in the current user's personal order. It uses the generated `projects/order.list` page without a DTO or client sort. The preserved native session owns the workspace; the existing Create Project context owns its empty-state command and global dialog. Empty nonfinal pages automatically continue only while no eligible project is loaded and the native hook reports `CanLoadMore`. The themed inherited empty state appears only at `Exhausted`; loading is not an empty workspace.

This route candidate requires fresh local order coverage before isolated activation. Actual redirect/order, sparse pagination, Create Project dialog, membership/lifecycle revocation, guest behavior, reload and constrained-width Chrome evidence remain unverified until their exact release is exercised. Remote acceptance and the unmounted ordered chooser below are separate gates.

## Verification and remaining scope

The historical ordering receipt covered prepend ordering, both revision checks/adjacency, guest-private order and owner isolation, revocation/rejoin retention, archived sparse pages and restored position, repeatable backfill including inactive membership, duplicate/integer exhaustion rollback, concurrent creation, and explicit 200-row neighbor overflow. No new repository test is added by the entry-route migration. Current TypeScript 7, scoped Oxc and complexity checks are separate source gates. Actual chooser and browser acceptance await cutover.

The exact inherited owners/routes and consumer evidence are in `PERSONAL_PREFERENCES_PLAN.md`. ProjectMember's separately registered views/default props and member-targeted preferences are not silently aliased. Navigation defaults/hidden tabs, page block layout, task filters/rich expressions, grouping/order/layout/display properties remain further native work. No full project preferences parity is claimed.

## Prepared consumer (not mounted)

`projects/ordered-chooser.tsx` supplies a keyboard-accessible personal project list with up/down buttons and captured moving/neighbor revisions. It keeps the current selected project in the summary even if that row is outside loaded pages. Empty filtered pages retain Load more; moving the last loaded item down requires loading its successor. Reorder mutations never update route parameters. Explicit project selection alone changes identifier and clears stale entity/deep-link parameters through `order-selection`, covered by a module-owned regression. No current consumer imports this component before both-host receipts.
