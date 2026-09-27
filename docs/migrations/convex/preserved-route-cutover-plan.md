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

## Concrete consumed types and write boundaries

| Current consumer | Existing typed input actually read | Existing actions / canonical native owner |
| --- | --- | --- |
| `AuthenticationWrapper` | `IUser.id`, `is_password_autoset`; `TUserProfile.id`, `is_onboarded`, four `onboarding_step` flags; `IUserSettings.workspace.last_workspace_slug/fallback_workspace_slug`; accessible `IWorkspace.slug` collection | `fetchCurrentUser` bootstraps user/profile/settings/workspaces. Native `identity.preferences.destination` already owns onboarding completion and authorized selected/oldest fallback; native password-account status must be read from its account owner, not invented as `is_password_autoset`. |
| `WorkspaceAuthWrapper` | accessible workspace list/current slug; `IWorkspaceMemberMe` from `workspaceInfoBySlug`; `allowPermissions` workspace/project roles; user email | Starts eight existing owners: self membership, project permissions, partial projects, workspace members, favorites, states, sidebar preferences, project navigation preferences. Native navigation/access, project order/features, directory, favorites, states and preference APIs exist, but complete reactive consumers and corresponding mutations must move together. |
| `WorkspaceMenuRoot` / `SidebarDropdownItem` | `IWorkspace.id/name/slug/logo_url/role/total_members`, `IUser.email`, instance workspace-creation flag, sidebar mobile state | `selectWorkspace` plus navigation is already shared with PowerK. Native field-only `identity.preferences.selectWorkspace` is available. Native authenticated logo descriptors cannot become fake public `logo_url`; exact member-count contributions must exhaust pagination before presentation. |
| `ProjectsAppPowerKProvider` | `IUser.id`, canonical route params and issue identifier→ID→project lookup, `TPowerKContext`, `TPowerKCommandConfig` | Mounts actual workspace/project/work-item modals and their legacy writers. Opening native data alone leaves competing writers. Command families must migrate with their modal/query owners; current shared workspace navigation is a prerequisite only. |

No new legacy-shaped DTO was added. Native SignIn and the disabled native-stickies route authenticate in place, preserving their current URL already; manufacturing a native redirect consumer would add unused behavior.

## Implemented auth-return prerequisite

The actual production redirect path had a weaker local validator than the existing `@plane/utils.isValidNextPath`, while guard and HTTP-401 redirects discarded query/hash and OAuth URLs concatenated unencoded `next_path`. The production authentication wrapper now uses the canonical validator. The shared `helpers/auth-return.ts` composes one encoded return parameter for the guard, HTTP-401 interceptor and configured OAuth endpoints. Password/magic form handoff validates the same local destination before submitting it. Query and hash selection survive as part of the one parameter; external/protocol-relative/executable destinations are not forwarded.

The helper knows only an already-owned auth endpoint and a local return path. It neither selects a workspace nor authorizes the destination. Existing route guards remain the access owner; onboarding precedence, last/fallback workspace validation, transports and production presentation are unchanged. No native route is enabled.

Two behavioral tests exercise full selection round-trip and rejected untrusted destinations through the production-used composition owner; they are included by the routine workspace-navigation test glob. Native web TS7 and five-file scoped Oxc pass; form-root retains its two preexisting no-shadow/always-return warnings, verified against HEAD. Browser end-to-end auth redirect acceptance remains unverified at this source checkpoint.

### Primary Chrome follow-up

After `a9b1e1ee5f`, an already authenticated local Django session opened the auth root with an encoded return path to the synthetic NDBC-3 task. Chrome reached `/summon-local-qa-20260926/browse/NDBC-3/?view=mine&source=auth-qa#description`, retained both query parameters and the fragment, and rendered the saved task in the preserved shell. A protocol-relative `//evil.invalid` return path stayed on localhost and selected the authorized workspace home. No task data or credentials changed. These checks prove authenticated return selection, not a complete signed-out password/OAuth round trip or HTTP-401 interception.

The first attempt exposed a stale Vite resolver entry: an importer referenced the former `/core/helpers/auth-return.ts`, whose HTTP200 response was HTML, while the committed helper lives at `/helpers/auth-return.ts`. Touching the importer did not invalidate the resolver. Only the owned local3010 dev process was restarted, retaining its three launch-time Vite variables and existing dotenv configuration; the corrected served import and Chrome render then passed. Existing local QA tabs were checked for active drafts before restarting. No duplicate helper, source fallback, repository environment change or production restart was introduced. The routine web suite passed69 tests; the coordinating owner independently ran the preceding67-test suite before the two redirect cases were added.

Complexity receipt (classic): `AuthenticationWrapper`54→51 as three duplicate redirect expressions disappear; the existing page-type/auth/onboarding choreography remains above20 and is explicitly outside this transport-preservation prerequisite. New URL owner3; each OAuth click handler1. This does not claim the guard itself is simplified. Cognitive assessment: return-path composition is clear; guard bootstrap is still a cutover owner requiring a coherent future replacement. Routine web gate69/69 passes.
