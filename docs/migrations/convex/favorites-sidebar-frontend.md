# Native sidebar and favorites hierarchy

## Boundary traced before implementation

Closure ledger 4a identifies inherited workspace sidebar/bootstrap as a real route-cutover dependency. `SidebarFavoritesMenu`, `FavoriteFolder`, `FavoriteItemTitle`, project navigation, and the inherited sidebar mount MobX favorite/project/theme/preferences stores and Next route/session consumers. Importing that shell directly would restore Django bootstrap. The pure `SidebarNavItem` presentation owner has no store dependency and is reused with generated native data.

This slice relocates all fifteen existing native module links into the workspace sidebar, beside hierarchical favorites, quick links, and profile. It does not replace inherited routes or synthesize missing user/sidebar preferences. Existing native routes, module destinations, and selected entity URL keys remain intact. Navigation constructs fresh destination params just as the previous module buttons did; opening a folder does not change the current content route.

## Experience and rendered acceptance plan

Inspected [Linear favorites/sidebar](https://mobbin.com/screens/c36fa084-f27b-4812-8550-b56544f39e93): concise workspace sections, favorites near primary navigation, content given the central canvas. Inspected [Notion move destination](https://mobbin.com/screens/0df641e3-d047-4712-9479-d491e52d984f): explicit destination selection alongside nested private/team content. A narrower Linear search succeeded after the initial query failed. The provided Figma link was not newly inspected for this bounded slice; no claim is made about matching unobserved Figma details.

Compared retaining the top module-button wall plus another favorites screen with a persistent navigation hierarchy. Chose the sidebar because favorites are shortcuts into existing work, and the content area should begin with the selected module. Reused existing row styling, icon sizing, typography tokens, native buttons, and shared dialogs. Desktop shows full module navigation and the favorite tree in the scrolling sidebar. Narrow widths expose a Navigation disclosure, close it when following a destination, and leave folder expansion under the user's control. Deep trees have contained horizontal scrolling rather than silently dropping levels or overflowing the viewport.

Folders use nested lists and explicit expanded buttons (native Tab/Enter/Space behavior, no incomplete ARIA tree role). Only expanded folders query children. Each bounded page retains Load more even when filtered targets leave it empty. Removed items are scoped to their current folder, with ancestor recovery required before its children become accessible. There is no claimed global favorite count or global Trash enumeration.

## Owners and verification

Canonical backend projections supply current readable names/project identifiers and capabilities. Guest access skips the favorite owner based on its access query. Rename/move/lifecycle dialogs capture the selected row; server reorder owns sibling order instead of guessing from loaded pages. Folder destination selection is bounded and cannot silently truncate choices. Entity links use each row's generated target and project identifier; no ID casts or per-row project fetches occur.

Frontend activated after primary authorization. Native web TS7 passes, scoped Oxc reports zero findings across twelve files, and three behavior tests verify canonical task, project/workspace view, document, cycle, module, and folder routes. Backend deployment, owner peer review, and desktop/390px Chrome acceptance remain pending. Existing saved-view controls retain their public endpoints and now use the shared favorite owner after the primary-verified backfill/cutover. Folder moves receive destination order from the server; a collapsed manual Order field provides recovery for imported equal-order values. Reordering is disabled while unsaved label, destination, or order changes exist. Drag-and-drop parity, recent visits, persisted navigation preferences, and inherited route retirement remain unimplemented.

## Primary Chrome acceptance

Backend cutover 4e9cbf94f1 deployed from a committed archive to local and remote; follow-up be39abe18f retired migration endpoints. Local Chrome on port3010 verified folder creation, migrated saved-view label and folder move, nested deep-link, canonical reorder, folder removal hiding the saved-view star, and restoration restoring the star. At390px the collapsed navigation opened all15 module links without viewport overflow; the override was reset. Desktop screenshot inspected the shared row hierarchy and truncated labels.

A concurrent-removal regression was reproduced after the fix: one session held a typed favorite label while browsing a folder, a second session removed that folder, and the first kept the unsaved text while showing a local recovery action. Browse from favorites root retained the text and restored destination navigation. The editor snapshot is owned above recursive query branches. This scoped development-build acceptance is not public frontend deployment or inherited route retirement.
