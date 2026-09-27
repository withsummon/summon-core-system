# Preserved Stickies account and help controls

The legacy `workspace/sidebar/user-menu-root.tsx` and native `workspace/native-shell/account-menu.tsx` now share `UserMenuView`: the same cover/avatar hierarchy, Settings, Preferences and sign-out presentation. The legacy consumer retains its actual MobX modal commands. Native identity fields come directly from the generated profile query; avatar bytes use the existing authenticated asset reader. There is no legacy-shaped user object or Django hook in the native consumer. Native profile cover storage has no owner yet, so the existing default cover is rendered; uploaded legacy cover parity is not claimed.

Settings and Preferences navigate to the registered `/settings/profile/general` and `/settings/profile/preferences` routes after flushing sticky drafts. These are explicitly unmigrated destinations outside the selected Stickies route. The native entry uses the full settings page rather than embedding a Django-backed profile modal into a Convex session. A failed flush leaves the route and draft intact and displays its error. Sign-out uses the shell's flush-aware callback.

Legacy and native help controls share `HelpMenuView`. Native keyboard help opens the verified `https://docs.plane.so/support/keyboard-shortcuts` page, and updates opens the existing ProductUpdatesFooter changelog link. Documentation, contact and forum retain their actual existing destinations. Native help does not mount the legacy PowerK registry or instance-backed changelog modal. The legacy consumer retains both modal workflows.

Scoped Oxc/format checks pass. Browser rendering, avatar loading and navigation are part of the parent Stickies route acceptance; this receipt does not substitute source checks for those runtime gates.
