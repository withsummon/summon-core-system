# Preserved Stickies feature controller

## Boundary and provenance

The selected migration boundary is the existing `/:workspaceSlug/stickies` route inside the preserved production shell. `NativeStickiesProvider` owns one generated Convex query/mutation controller shared by its page and All stickies modal. The shell consumes only `useStickiesCommands` (`create`, `openAll`, `closeAll`, `allOpen`, `flushAll`). Route activation and authentication are owned outside this module.

The existing route header, search control, modal composition, responsive column breakpoints and LiteTextEditor/toolbar are extracted into actual shared presentation owners used by the still-active legacy callers. Their classes, labels, palette, editor format controls and modal widths come from the production Stickies implementation. Native code never constructs a legacy `TSticky` or `IStickyStore`. The old home widget remains explicitly on its existing legacy route; it is not mounted inside this selected native route.

The native editor does not call legacy `useEditorConfig`, `useParseEditorContent`, workspace stores, SWR or command stores. Sticky attachments remain unsupported, matching the existing editor's empty upload handlers. Native file operations reject rather than producing fake uploaded IDs.

## Mutation and draft invariants

- One serial `StickyDrafts` writer per note is shared across page/modal editor instances. Subsequent saves use the exact previous mutation acknowledgement; reactive revisions never rebase a dirty draft. An older reactive row cannot roll back an acknowledged version.
- Identical content changes and editor migration-only initialization callbacks do not write. Clean drafts follow reactive rows through the editor's existing controlled-value path; distinct editor DOM IDs use React `useId` without changing note identity.
- Save failures preserve local HTML/color and show recovery. Retry uses the same captured revision; discard explicitly loads the latest saved row. Navigation blocks while pending/error drafts exist. Before unload warns, sign-out `flushAll` rejects incomplete saves, and unmount does not initiate writes.
- Delete flushes the note before opening confirmation and captures that acknowledged revision; confirmation cannot silently adopt a later peer edit. Reordering uses canonical server `move`, both loaded endpoint revisions and actual index neighbors, not client midpoint arithmetic.
- One bounded paginated query supplies all native presentations. Sparse search pages continue to their cursor boundary before showing an empty result. Loaded notes retain one owner even when the shared search changes.

## Verification at source checkpoint

Five module-owned behavior tests cover shared serial acknowledgement, peer changes during a pending save, conflict/draft retention, exact retry, explicit discard, clean reactive updates, mount no-op no unmount flush, and edits queued during a delayed move using its exact acknowledgement. Native web TypeScript 7 check passes; focused Oxc reports zero warnings/errors. Root owns live Chrome acceptance and runtime source identity; those are separate from these source checks.

The existing `/core` Stickies UI is not this route's renderer. No Django retirement, production route deployment, complete workspace migration, or home-widget cutover is claimed by this feature receipt.

## Development-only Masonry finding

Root's live development inspection found that installed `react-masonry-component` destroys its Masonry instance during React StrictMode effect replay but retains the truthy instance reference. Its next mount skips initialization: calculated offsets remain but initialization positioning is absent. No CSS positioning mask, timer, private-instance patch or dependency change is introduced here. Real legacy/native grids share the existing Masonry owner with its supported `enableResizableChildren` option for editor height changes. Layout acceptance must use the immutable production build, where this development replay does not run; that verification is pending separately.
