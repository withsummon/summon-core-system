# Native registered surfaces

Inventory baseline: 2026-09-29, immutable export of committed `26fbe4bbf338073c324ba9e8ead55fb341a823d0`, refreshed by the scoped owner deltas below; unrelated profile and task-property candidates are excluded. The [native ledger](registered-native-surface-2026-09-28.tsv) contains **635 distinct rows, all OPEN** after removal of the unconsumed `savedViews/workspace:access` query and addition of three public Commercial queries. Its 19 moved saved-view declaration anchors were refreshed against committed `ee93a305e9e87c954c7ed493240818b6654970b0` on 2026-09-30. The existing `tasks/center:list` anchor moved to line 49 after `23affde7b9`, then line 55 after `b1ee4aa56e`. It complements the [inherited surface ledger](registered-surface-2026-09-28.tsv); registration establishes an owner, not equivalent behavior, browser acceptance or a served deployment.

On 2026-09-30, the list-owner refresh checked all 44 direct RPC declarations in nine changed query files against committed `2a9b29a2aaf1d559a37f07864440900e388ac7f6` and corrected 36 source anchors. It changes no registration, visibility or acceptance status. 2026-09-30 ledger SHA-256: `2acccf4998fbc24383b897c17afeebb45d9d146772c880ad49e7be1ca26ced99`. Receipt: `/tmp/summon-paging-20260930-native-anchor-refresh.json`. This scoped refresh does not rerun the historical SDK/factory/HTTP inventory audit.

## Registered boundaries

| Surface                     |    Rows | Meaning                                                                                                             |
| --------------------------- | ------: | ------------------------------------------------------------------------------------------------------------------- |
| App RPC                     |     552 | 470 public and 82 internal declarations across generated app modules.                                               |
| Component export            |       8 | Local Better Auth adapter exports; all eight generated references are internal to the parent app, not browser RPCs. |
| HTTP action declaration     |       4 | Asset and assistant handlers; their routing mounts are separate boundaries.                                         |
| HTTP routing mount          |      13 | Four common mounts, four native auth factory mounts and five alternative Convex Auth factory mounts.                |
| Better Auth HTTP descriptor |      51 | Pathful SDK candidates, including disabled paths and provider path parameters.                                      |
| Better Auth server API      |       7 | SDK operations excluded from HTTP routing.                                                                          |
| **Total**                   | **635** | **All OPEN.**                                                                                                       |

The current ledger records 564 declarations: 556 app exports and eight component exports. The four retained `auth` factory RPCs are included in that count; switching HTTP factories does not unregister them. Plain helpers, schemas and generated copies are excluded. The six native cron registrations already have rows in the inherited ledger; their target functions are counted here once as declarations.

This snapshot includes viewer-owned profile preferences and their canonical revision/filter writer, the generated profile subject/list/summary reads, field-specific title acknowledgement, raw project/task-ID address resolvers, Members directory/role writer, sign-in recorder and ID-based invitation owners, preserved Pages address resolution, the canonical Yjs snapshot action and current-permission member activity/day-export reads. Deleted `better_auth:sessionUser`, `intakes/index:get`, `tasks/index:resolve`, invitation token functions and superseded member/invitation RPCs have no rows. Creator name/avatar and rendered project logo are projections from existing task/address owners, not additional RPCs. Intake selection requires the canonical project scope; open/closed cohorts are part of the list view contract. The generated project feature resolver adds the raw address and effective settings role; its scoped local Chrome receipt is in the [current checklist](current-parity-checklist.md#preserved-project-feature-settings-2026-09-29). These source contracts still need complete production acceptance.

## HTTP candidates and availability

`http.ts` always mounts asset GET/OPTIONS and assistant POST/OPTIONS. Native auth mounts discovery GET plus GET/POST/OPTIONS under `/api/auth/*` when `betterAuthEnabled` is true. The five Convex Auth factory mounts belong to the alternate branch; three additionally require a configured OAuth provider. These are candidate registrations across branches, not 13 simultaneously active mounts.

Better Auth exposes 58 SDK descriptors: 51 pathful HTTP candidates and seven server APIs. Installed Better Call excludes `SERVER_ONLY` operations from its HTTP router. Better Auth returns 404 for normalized paths in `disabledPaths`; the server `auth.api` registry remains available. Eleven HTTP paths are always disabled, including account lifecycle/password bridges and API-key management. Four more OTP paths depend on the canonical sign-in/reset policy. Thus at most 40 descriptors remain after the fixed exclusions, and 36 in the metadata fixture with all four conditional paths disabled. Neither number proves a reachable or authorized production endpoint: native capability checks, providers, trusted origins, method and auth-engine selection still apply. Prefix mounts are routing owners, not additional SDK functions.

Installed owners: Convex `1.46.0`, Better Auth component `0.12.5`, Better Auth and API-key plugin `1.6.33`, `convex-helpers` `0.1.124`, retained Convex Auth `0.0.95`, and Better Call `1.4.0`. The [workspace manifest](../../../pnpm-workspace.yaml) pins the repository patches for the auth packages. SDK source anchors in the ledger refer to this installed, patched source; reproduce them with those locked versions.

## Acceptance families

Apply the existing [24-family journeys and acceptance rule](current-parity-checklist.md#scope-and-acceptance-rule) to every ledger row, including its exact role, denial/recovery behavior and public contract. These are primary-family declaration counts only; HTTP mounts and SDK descriptors remain separately inventoried. No family is closed by the count.

| Family         | Declarations | Family        | Declarations |
| -------------- | -----------: | ------------- | -----------: |
| Identity       |           23 | Account       |           27 |
| Instance       |            7 | Workspace     |           39 |
| Shared shell   |           22 | Projects      |           58 |
| Tasks          |           73 | Cycles        |           22 |
| Modules        |           23 | Intake        |           13 |
| Views/search   |           23 | Documents     |           38 |
| Assets         |           28 | Commercial    |           21 |
| Meetings       |           18 | Resources/MCP |           37 |
| Assistant      |           28 | Automation    |           15 |
| Reporting      |            7 | Notifications |           13 |
| Public sharing |            0 | External API  |            1 |
| Stickies       |            9 | Operations    |            2 |

## Seven concrete owner mappings

These locate replacement candidates without asserting REST payload or journey equivalence. Both sides have source anchors in their respective ledgers.

| Inherited registration                                                  | Native candidate                                                        | Remaining boundary                                                                                                                                                         |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/auth/email-check/`                                                    | `identity/entry:check`                                                  | Native credential/magic policy and signup discovery; old response shape is not carried forward.                                                                            |
| `/api/users/me/`, `/api/users/me/profile/`                              | `identity/profile:{get,save}`, `identity/deactivation/index:deactivate` | Profile and lifecycle ownership; activity/graph APIs are separate journeys.                                                                                                |
| `/api/users/me/notification-preferences/`                               | `notifications/index:{preferences,savePreferences}`                     | Notifications owns storage; Account owns tab acceptance; real delivery is separate.                                                                                        |
| `/api/workspaces/`                                                      | `workspaces/index:{list,create}`                                        | Native directory/create ownership; onboarding, invitations and the external REST envelope need their own acceptance.                                                       |
| `/api/users/last-visited-workspace/`                                    | `identity/preferences:{destination,selectWorkspace}`                    | Profile preferences and current membership own selection; shell navigation remains a separate journey.                                                                     |
| `/api/users/api-tokens/`, `/api/users/api-tokens/<uuid:pk>/`            | `identity/apiTokens:{list,create,revoke}`; internal `verify`            | Management is distinct from an external transport. Native IDs, hashing, rate windows and expired-row retention do not establish `/api/v1/` equivalence.                    |
| `/api/summon/workspaces/<str:slug>/projects/<uuid:project_id>/profile/` | `commercial/delivery:{getProfile,saveProfile}`                          | Commercial project profile with project permissions. The inherited ledger now assigns Commercial as primary and Projects as secondary; this is not an account-profile API. |

## Verification and limits

The historical 2026-09-29 checks matched all 244 generated app module names, 245 inspected module-source hashes, 544 declaration anchors, 88 HTTP/SDK/policy owner anchors and all 615 unique ledger rows. The 14 factory exports match their installed constructor kinds and source hashes; all eight component references carry parent visibility `internal`. The 56 excluded value exports are helpers, schema/config values or routing helpers. The Cycle/Module slice adds seven registered application RPCs: `cycles/index:{browse,address}`, `modules/index:{catalogue,directory,address,patch}` and `modules/tasks:setMany`. Projects adds `projects/directory:memberships` for complete currently authorized human roster contributions. No retained declaration changes visibility; the canonical document writer remains internal. The shared task-create validator is an ordinary schema export, and saved drafts reuse its prepared writer. No HTTP transport was added.

Operators read `/private/tmp/summon-projects-integration-20260929-v12-source` and verify all 6,208 committed file hashes in `/tmp/summon-projects-integration-20260929-v12-owner-source-identity.json`. Source identity SHA-256: `dd2d3ebaffd5da91d2cc6d8ea9464d85298a4d19fdaa7d34f9dc5683dcb9018c`; generated API SHA-256: `31dc1a71dbeb7d7c4407b4502f0ab422b108c43fb0f9a0eb57854984d39eff2d`. Historical native ledger SHA-256: `7c2699093fe4be9380c6d77cc9f2848a781d6ff02e464352053fc87d58e049ca`; saved-view anchor refresh SHA-256: `d2fa5167d30ecc7f1c89236284467a2ff7f8ff36672f3bf75e58cfd0173676ec`; earlier Task Center anchor ledger SHA-256: `fe1ecee93bc61a135eefeb034b951cb71806c9b5cdad41396002119f419c611d`; 2026-09-29 native ledger SHA-256: `a7e1242a27ebcb047647ba81bb83126058d8d81bf18ef9cd5c0f3e31235e31c2`; historical inherited ledger SHA-256: `4c38d9a5fead7e123f91f8acb178433b5307ff1614931fce1e799846c0ea4b09`; earlier All Issues ledger SHA-256: `50e5316f217db56057c380bff928345f421098ec5cc12f049b3a1daff1c33eb4`; four-mode inherited ledger SHA-256: `dd5b948046b5617b25e923c759b1ae4caec6c7e1494a596fe8aa9c613dbc7da4`. The 2026-09-29 HTTP app/SDK/factory/policy hashes and source anchors match that immutable snapshot; the 2026-09-30 refresh rechecked the 19 saved-view export declarations without changing registration or visibility. Independent JSX AST extraction for the earlier snapshot matches 289 dialog roots and records 15 native command/chooser mount expressions separately from the 93 command identifiers. The mapped project-command JSX spread and the Cycle/Project `PowerKMenuBuilder` call sites are included. Dynamic rendered labels and result-backed choices require actual journey capture; these are static call sites, not distinct command or parity counts.

Evidence: `/tmp/summon-projects-integration-20260929-v12-{native-inventory,native-ledger-refresh,registered-surface-refresh,jsx-audit}.json`; unchanged HTTP metadata comes from `/tmp/summon-project-directory-pages-20260929-http-metadata.json`. The [current Projects receipt](current-parity-checklist.md#preserved-projects-directory-creation-and-navigation-2026-09-29) separates source registration from its scoped isolated API/Chrome acceptance. Historical artifacts remain preserved.

No native inbound `/api/v1/`/webhook, anonymous public-sharing or MCP-server HTTP mount is registered. Internal PAT verification is a candidate owner, and `mcp/*` is an outbound client. Configured endpoint availability, real mail/OAuth/providers, external API capacity, browser dialogs/commands, jobs, backup/restore, rollback and exact served-build identity remain acceptance work. This inventory changes no deployment or parity status.

## Meeting Workspace owner refresh, 2026-10-02

The scoped Meeting slice adds 18 direct native declarations (11 public, seven internal), refreshes 55 declaration anchors in changed owner files and reuses the existing private asset HTTP mounts. An independent Babel AST walk of the frozen source found 73 native declarations in those files; every one maps to the ledger. Generated `api.d.ts` adds only the recording and transcription modules. The 632 rows remain OPEN. This refresh does not rerun the historical SDK/factory audit. Local API/Chrome proof and remaining production gates are recorded in the [current checklist](current-parity-checklist.md#preserved-meeting-workspace-2026-10-02).

Meeting refresh 632-row native ledger SHA-256: `702addb0c180ce21daa38e2bc6574ee8fbba2430049dc0cb32516ecf8920ed13`.

## Preserved Commercial owner refresh, 2026-10-02

The 31-path scoped frozen source adds three public queries: `commercial/clients:{counts,related}` and `commercial/opportunities:counts`. An independent Babel AST walk found 16 direct native declarations in the changed backend files and refreshed nine existing source anchors; every declaration maps to the ledger. The related count modes share the existing query registration, and schema/helper exports are not additional RPCs. No generated module or HTTP transport was added.

The inherited ledger moves four Client/Opportunity routes and their four existing command identifiers into the native workspace session. The four labels extend one existing mapped command mount; totals remain 93 command identifiers and 15 mount expressions. Two primitive dialog roots move to the canonical form owners, and the obsolete `CreateOpportunityDialog` wrapper and orphaned delivery-card `CreateProjectModal` disappear: 978 inherited rows, including 291 dialog roots. Route and shared-command source anchors match the frozen source. All 635 native rows and 978 inherited rows remain OPEN; source registration does not establish production parity, external API compatibility or retirement.

Static receipts: `/tmp/summon-commercial-qa-20261002/{registrations,route-registrations,ledger-refresh}.json`. This scoped walk does not rerun the historical SDK/factory/HTTP inventory audit or establish browser acceptance. The current checklist owns the separate runtime and acceptance receipt.

Current 635-row native ledger SHA-256: `73bdfcad6cf133236e46e914aefb29c91b22d9614ad62c186c964dcf9aefdbc4`. Current 978-row inherited ledger SHA-256: `c49a026b4159ca9e2e1a708bcd04690a0514b36bb92330b560a71dccbb4946ab`.
