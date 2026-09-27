# Preserved production route cutover: source audit

## Decision

The deployed `afe708b92370542e09dd065454337e3c83c08604` presentation remains the baseline. No route is switched by this audit. Stickies is the smallest bounded **domain** candidate, but no authenticated workspace page currently has an independent Convex-ready shell. A content-only swap would leave mixed authentication and writers.

## Current root blockers

| Owner                                                        | Actual dependency                                                                                                            | Required closure                                                                                                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/routes.ts`, `app/legacy-layout.tsx`, `app/provider.tsx` | Legacy routes mount StoreProvider, StoreWrapper, InstanceWrapper and SWR                                                     | Establish one authenticated runtime owner while retaining presentation; do not manufacture legacy user/project DTOs from incomplete native rows. |
| `core/lib/wrappers/authentication-wrapper.tsx`               | Django current user, profile/settings and workspace bootstrap                                                                | Native identity, private profile, onboarding and workspace selection must drive the existing controls coherently.                                |
| `core/layouts/auth-layout/workspace-wrapper.tsx`             | Workspace role, project permissions, partial projects, members, favorites, states and sidebar/project navigation preferences | Convert actual sidebar consumers and their mutations with each canonical native owner; avoid a bulk response with guessed fields.                |
| `app/(all)/[workspaceSlug]/(projects)/layout.tsx`            | Sidebar, extended sidebar and ProjectsAppPowerKProvider are mounted for stickies too                                         | Preserve deployed composition and keyboard behavior.                                                                                             |
| `core/components/power-k/projects-app-provider.tsx`          | Legacy issue lookup, user store, workspace/project/work-item modals and command actions                                      | Switch callable commands with their real mutation owners; mounting a native body cannot leave these as silent alternate writers.                 |

## Why the existing opt-in is not the answer

`app/routes/ownership.ts` defaults `SUMMON_STICKIES_ROUTE_OWNER` to legacy. The opt-in route is outside LegacyLayout. `app/native-stickies.tsx` uses native authentication and slug resolution correctly, but renders a different standalone header/body, imports the temporary `convex-core/stickies` interface, and links to `/core`. It therefore proves an isolated auth boundary, not preservation of the approved deployed shell. Do not enable it as product cutover.

## Recommended next bounded implementation

1. Inventory and type the existing workspace shell's **real consumed fields/actions**, then replace authentication/workspace selection and sidebar/PowerK owners together where required. Retain route paths, existing visual components and deployed interactions. Missing native fields remain implementation blockers, not fabricated defaults.
2. Port the complete sticky family using generated native records directly at the feature boundary: `stickies/page.tsx`, `header.tsx`, `core/components/stickies/{layout,sticky,modal,widget,action-bar,delete-modal}` and the existing sticky editor. Preserve create-on-empty rules, autosave, color selection, modal search, infinite loading and drag positioning. Native `stickies/index.ts` already owns private CRUD, CAS, rich content, ordering and recovery.
3. Replace `core/store/sticky/sticky.store.ts` / `core/services/sticky.service.ts` as the sticky data owner only when **all** call sites, including home widget and modal, use the native owner. Do not populate `TSticky` with fake UUIDs or emulate REST total-pages from Convex cursors. Native pagination must retain sparse continuation; drag actions need captured authoritative versions.
4. Acceptance: same deployed shell/page at desktop and narrow width, keyboard/PowerK parity, page/widget/modal edits converge, two-tab content/order conflict preserves drafts, member revocation clears private content, and no sticky REST writes remain. Authenticated network evidence must distinguish shell legacy requests from a fully closed route family.

This is source evidence only. No new screen, route switch, provider change or retirement was implemented. The remaining shell scope is a prerequisite, not a claim that the entire shell should be replaced in one unreviewable patch.
