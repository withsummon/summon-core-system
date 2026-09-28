# Native registered surfaces

Snapshot: 2026-09-29, immutable export of committed `1025230af04352797cd43629f8a34e66af866745`; uncommitted Activity/profile/project presentation candidates are excluded. The [native ledger](registered-native-surface-2026-09-28.tsv) contains **601 distinct rows, all OPEN**. It complements the [inherited surface ledger](registered-surface-2026-09-28.tsv); registration establishes an owner, not equivalent behavior, browser acceptance or a served deployment.

## Registered boundaries

| Surface                     |    Rows | Meaning                                                                                                             |
| --------------------------- | ------: | ------------------------------------------------------------------------------------------------------------------- |
| App RPC                     |     518 | 443 public and 75 internal declarations across generated app modules.                                               |
| Component export            |       8 | Local Better Auth adapter exports; all eight generated references are internal to the parent app, not browser RPCs. |
| HTTP action declaration     |       4 | Asset and assistant handlers; their routing mounts are separate boundaries.                                         |
| HTTP routing mount          |      13 | Four common mounts, four native auth factory mounts and five alternative Convex Auth factory mounts.                |
| Better Auth HTTP descriptor |      51 | Pathful SDK candidates, including disabled paths and provider path parameters.                                      |
| Better Auth server API      |       7 | SDK operations excluded from HTTP routing.                                                                          |
| **Total**                   | **601** | **All OPEN.**                                                                                                       |

The 530 declarations comprise 522 app exports and eight component exports. The four retained `auth` factory RPCs are included in that count; switching HTTP factories does not unregister them. Plain helpers, schemas and generated copies are excluded. The six native cron registrations already have rows in the inherited ledger; their target functions are counted here once as declarations.

This snapshot includes the generated profile subject/list/summary reads, field-specific title acknowledgement, raw project/task-ID address resolvers, Members directory/role writer, sign-in recorder and ID-based invitation owners. Deleted `intakes/index:get`, `tasks/index:resolve`, invitation token functions and superseded member/invitation RPCs have no rows. Creator name/avatar and rendered project logo are projections from existing task/address owners, not additional RPCs. Intake selection requires the canonical project scope; open/closed cohorts are part of the list view contract. These source contracts still need their complete route, role and recovery acceptance.

## HTTP candidates and availability

`http.ts` always mounts asset GET/OPTIONS and assistant POST/OPTIONS. Native auth mounts discovery GET plus GET/POST/OPTIONS under `/api/auth/*` when `betterAuthEnabled` is true. The five Convex Auth factory mounts belong to the alternate branch; three additionally require a configured OAuth provider. These are candidate registrations across branches, not 13 simultaneously active mounts.

Better Auth exposes 58 SDK descriptors: 51 pathful HTTP candidates and seven server APIs. Installed Better Call excludes `SERVER_ONLY` operations from its HTTP router. Better Auth returns 404 for normalized paths in `disabledPaths`; the server `auth.api` registry remains available. Eleven HTTP paths are always disabled, including account lifecycle/password bridges and API-key management. Four more OTP paths depend on the canonical sign-in/reset policy. Thus at most 40 descriptors remain after the fixed exclusions, and 36 in the metadata fixture with all four conditional paths disabled. Neither number proves a reachable or authorized production endpoint: native capability checks, providers, trusted origins, method and auth-engine selection still apply. Prefix mounts are routing owners, not additional SDK functions.

Installed owners: Convex `1.46.0`, Better Auth component `0.12.5`, Better Auth and API-key plugin `1.6.33`, `convex-helpers` `0.1.124`, retained Convex Auth `0.0.95`, and Better Call `1.4.0`. The [workspace manifest](../../../pnpm-workspace.yaml) pins the repository patches for the auth packages. SDK source anchors in the ledger refer to this installed, patched source; reproduce them with those locked versions.

## Acceptance families

Apply the existing [24-family journeys and acceptance rule](current-parity-checklist.md#scope-and-acceptance-rule) to every ledger row, including its exact role, denial/recovery behavior and public contract. These are primary-family declaration counts only; HTTP mounts and SDK descriptors remain separately inventoried. No family is closed by the count.

| Family         | Declarations | Family        | Declarations |
| -------------- | -----------: | ------------- | -----------: |
| Identity       |           24 | Account       |           27 |
| Instance       |            7 | Workspace     |           39 |
| Shared shell   |           22 | Projects      |           56 |
| Tasks          |           69 | Cycles        |           20 |
| Modules        |           18 | Intake        |           13 |
| Views/search   |           23 | Documents     |           36 |
| Assets         |           28 | Commercial    |           18 |
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

Independent checks matched all 244 generated app module names, 245 inspected module-source hashes, 530 declaration anchors, 88 HTTP/SDK/policy owner anchors and all 601 unique ledger rows. The 14 factory exports match their installed constructor kinds and source hashes; all eight component references carry parent visibility `internal`. The 57 excluded value exports remain helpers, schema/config values or routing helpers. The added declaration is `navigation/address:resolveTaskId`; no HTTP transport was added.

Operators read `/tmp/summon-project-title-width-20260929-source` and verify all 6,195 immutable manifest file hashes in `/tmp/summon-project-title-width-commit-20260929.json`. Source identity SHA-256: `e45674dd5718ad70ce7f375b58cb137052ffe037c4c51860c274f6facdbedb2c`; `_generated/api.d.ts` SHA-256: `31dc1a71dbeb7d7c4407b4502f0ab422b108c43fb0f9a0eb57854984d39eff2d`. The updated native-ledger SHA-256 is `5930b5e8074e67ae670e42c2b853c34765edf6684aaa05d85b4cecac35d95985`; the separately reviewed inherited ledger has 916 OPEN rows and SHA-256 `cc291ffaab386fafdcffb25fa51751dc0824948b5220080cd14e57b3145b9c1e`.

The auth/HTTP app source is byte-identical to `ff55ddde8c5d799f72802cbb849bb2482b305f11`. Every retained installed SDK/factory/policy hash and captured anchor matches the current installation, so the previous metadata descriptors are reused. No endpoint, database operation or provider was invoked. Evidence: `/tmp/summon-convex-native-inventory-20260929.json` and `/tmp/summon-native-ledger-refresh-20260929.json`. Historical evidence and artifacts remain preserved.

No native inbound `/api/v1/`/webhook, anonymous public-sharing or MCP-server HTTP mount is registered. Internal PAT verification is a candidate owner, and `mcp/*` is an outbound client. Configured endpoint availability, real mail/OAuth/providers, external API capacity, browser dialogs/commands, jobs, backup/restore, rollback and exact served-build identity remain acceptance work. This inventory changes no deployment or parity status.
