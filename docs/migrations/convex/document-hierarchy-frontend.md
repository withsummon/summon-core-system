# Native document hierarchy

## Owner and scope

`documents/hierarchy.ts` owns parent edges and moves. A separate `documentParents` table has indexed child and parent lookups; the mutation uses a unique child lookup in its transaction so concurrent moves cannot create two parents. Existing documents and their producers need no field backfill. The document remains the owner of metadata revision, visibility, projects, assets, and collaborative content.

The native detail presents parent navigation, paginated child documents, and an explicit move dialog. All documents remain discoverable through the existing flat list. Parent visibility never grants access to a child; an inaccessible or removed parent is shown without its title. Each child and destination is checked by the existing document access owner. Moving does not alter sharing or CRDT state.

Moves capture both source and destination metadata timestamps. Locks, archive state, workspace boundaries, stale revisions, cycles, and excessive depth reject atomically. The named limits are 20 levels and 1,000 documents in a moved subtree; overflow is an explicit error rather than a truncated successful move. Retained removed children participate in depth checks so restoration cannot violate the bound. Detaching to top level remains possible when the old parent is unavailable.

## Verification

Four backend behavior tests cover stable identity/content scope, stale source and destination rejection, independent private-parent permissions and flat discoverability, unavailable-parent detachment, cycle/foreign-workspace/lock rejection, and depth/subtree limits. Native backend and web TypeScript checks pass; scoped Oxc reports no warnings. The full backend run had 431 passes and one unrelated stale cross-project task relation expectation, reported to its owner.

Backend checkpoint `26acc4ba07` was activated by the primary agent on both hosts. The detail component is now mounted below the editor; web TypeScript, scoped Oxc, and all 40 frontend behavior tests pass. Browser and responsive acceptance remain pending primary QA. Required journeys: move a document under another, navigate parent/child both ways, reject moving an ancestor below its descendant, preserve a stale move dialog after another tab changes the destination, keep a public child visible under a private parent, and detach that child. Inspect desktop and 390-pixel dialog layout.

## Remaining parity

This slice supplies hierarchy navigation and safe moves. It does not implement a whole-workspace recursive tree, document labels, historical CRDT version restoration, inherited project-to-project move semantics, or a legacy route cutover. The inherited page hierarchy is the product reference; document access remains the existing native policy rather than inferred ancestor permissions.

### Root Chrome acceptance

On local3010 after26acc4ba07 backend deployment, moved synthetic Delivery
acceptance meeting transcript beneath Delivery collaboration verified. The child
showed the canonical parent link; opening it showed the child in the parent's
list, with editor content retained. Attempting to move that parent under its
child returned the cycle error and kept the selected destination/dialog. Cancel
returned to the unchanged valid hierarchy. Desktop and390px dialog screenshots
were inspected; controls/text fit, and viewport override was cleared. The valid
parent edge remains as a fixture. Stale-destination and independent-private-parent
cases are backend-test evidence, not newly browser-exercised claims.
