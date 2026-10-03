# Preserved Stickies workspace shell

## Owner and boundary

The production Stickies route is the first bounded native route, not a replacement `/core` design. `PreservedStickiesShell` consumes the actual generated `workspaces.index.list` row/list and `identity.profile.get` result supplied by the route owner. It does not construct `IWorkspace`/`IUser` or initialize Django stores. The route owner supplies the native sticky `create`, `openAll`, and `flushAll` operations.

Presentation was extracted from the existing production consumers into shared owners: `WorkspaceContentFrame`, `WorkspaceProjectFrame`, `WorkspaceTopNavigation`, `SidebarContent`, `WorkspaceSidebarLink`, and `CommandSearchView`. Both legacy and native consumers render those owners. Their classes, hierarchy, full Summon navigation, Advanced Plane control and Assistant placement remain. Summon Stickies has no AppRail. The command-search clickable wrapper is now a real input label with a generated ID rather than a non-keyboard `div role=button`; its styles remain unchanged.

The native command list only owns Create new sticky and Open all stickies. Cmd/Ctrl+K toggles the existing search panel; filtering, selection and execution use cmdk. Input arrow events reach the cmdk list owner, Enter invokes its selected item, Escape closes. No legacy PowerK provider or command-store writer is mounted.

## Native actions

Workspace switching waits for `beforeLeave` (native sticky flush), then uses `identity.preferences.selectWorkspace`, then navigates to the selected workspace's existing Stickies URL. Modified link clicks retain browser behavior. A rejected flush or selection leaves the current route and displays an error. The workspace list is supplied once by the route owner; the menu's real member-count consumer reads all bounded contribution pages and only displays a number after exhaustion. No partial count is labeled total.

Sign-out also waits for the same flush and stays at the native route; the route's auth boundary shows sign-in after session removal. Theme uses the existing toggle and native revisioned preferences, preserving other preference fields. Logo reads reuse authenticated assets and their abort/revoke lifecycle.

Broader sidebar, workspace-settings/invitation/create, and Inbox destinations retain existing production URLs. Those destinations are still legacy-owned and may initialize Django requests after navigation. The native Stickies route itself does not mount those stores. Advanced Plane ordering/pinning customization is not migrated by this bounded shell; the registered links remain available.

## Verification

Initial shared-shell source gate: native web TypeScript passed; all 69 existing routine frontend tests passed. New shell/presentation Oxc gate passed. Classic complexity: shell 6, workspace menu 3, command component 1; largest nested keyboard handler 9. The extracted legacy `TopNavPowerK` retains three pre-existing hook-dependency warnings; no new warning was introduced into that owner.

Root owns Chrome acceptance against the recorded production shell on port 3010 and the native route on 3031, including narrow viewport, commands, modal, navigation, dirty flush and sign-out. These source/type/test checks alone do not claim browser or deployment acceptance. Account/help source integration is complete through shared `UserMenuView`/`HelpMenuView`. Native account actions flush notes before full navigation to registered `/settings/profile/general` and `/settings/profile/preferences`; this differs from the legacy modal entry and intentionally crosses into the remaining legacy settings route. Help shortcuts and updates open existing documented URLs rather than mount legacy command stores. Native account cover uses the existing default because no native user-cover owner exists. See `docs/migrations/convex/preserved-stickies-account-menu.md`. Browser acceptance remains root-owned.
