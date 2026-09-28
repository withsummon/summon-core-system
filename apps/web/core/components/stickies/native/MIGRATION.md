# Preserved Stickies feature controller

## Boundary and provenance

The selected migration boundary is the existing `/:workspaceSlug/stickies` route inside the preserved production shell. `native-workspace.tsx` mounts one `NativeStickiesProvider` and All stickies modal for native Stickies and preserved workspace General. The controller uses generated Convex queries/mutations and is keyed by the verified user, workspace and route pathname so leaving a discarded draft cannot retain a disposed writer. The shell consumes only `useStickiesCommands` (`create`, `openAll`, `closeAll`, `allOpen`, `flushAll`). Route activation and authentication are owned outside this module.

The existing route header, search control, modal composition, responsive column breakpoints and LiteTextEditor/toolbar are extracted into actual shared presentation owners used by the still-active legacy callers. Their classes, labels, palette, editor format controls and modal widths come from the production Stickies implementation. Native code never constructs a legacy `TSticky` or `IStickyStore`. The old home widget remains explicitly on its existing legacy route; it is not mounted inside this selected native route.

The native editor does not call legacy `useEditorConfig`, `useParseEditorContent`, workspace stores, SWR or command stores. Sticky attachments remain unsupported, matching the existing editor's empty upload handlers. Native file operations reject rather than producing fake uploaded IDs.

## Mutation and draft invariants

- One serial `StickyDrafts` writer per note is shared across page/modal editor instances. Subsequent saves use the exact previous mutation acknowledgement; reactive revisions never rebase a dirty draft. An older reactive row cannot roll back an acknowledged version.
- Identical content changes and editor migration-only initialization callbacks do not write. Clean drafts follow reactive rows through the editor's existing controlled-value path; distinct editor DOM IDs use React `useId` without changing note identity.
- Save failures preserve local HTML/color and show recovery. Retry uses the same captured revision; discard explicitly loads the latest saved row. Navigation blocks while pending/error drafts exist. Before unload warns; workspace switching, sign-out and workspace deletion await `flushAll` and reject incomplete saves. Unmount does not initiate writes.
- Delete flushes the note before opening confirmation and captures that acknowledged revision; confirmation cannot silently adopt a later peer edit. Reordering uses canonical server `move`, both loaded endpoint revisions and actual index neighbors, not client midpoint arithmetic.
- One bounded paginated query supplies all native presentations. Sparse search pages continue to their cursor boundary before showing an empty result. Loaded notes retain one owner even when the shared search changes.

## Verification at source checkpoint

The PR-local module test files were removed at the user's request; their earlier passing count is no current gate. Generated owners and operator integration receipts establish scoped source/runtime evidence; final committed-tree quality gates, Chrome journeys and served-build identity are separate root-owned receipts. Mixed or truncated working-tree Chrome captures do not close acceptance.

The existing `/core` Stickies UI is not this route's renderer. No Django retirement, remote native-auth activation, complete workspace migration or home-widget cutover is claimed by this feature receipt. The shared shell owns only Create new sticky and Open all stickies; inherited Power K and other registered destinations remain open.

## Development-only Masonry finding

Root's live development inspection found that installed `react-masonry-component` destroys its Masonry instance during React StrictMode effect replay but retains the truthy instance reference. Its next mount skips initialization: calculated offsets remain but initialization positioning is absent. No CSS positioning mask, timer, private-instance patch or dependency change is introduced here. Real legacy/native grids share the existing Masonry owner with its supported `enableResizableChildren` option for editor height changes. Layout acceptance must use the immutable production build, where this development replay does not run; that verification is pending separately.
