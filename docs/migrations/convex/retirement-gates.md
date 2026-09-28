# Django retirement gates

Status: **not ready to retire Django or its Postgres service**.

The [current parity checklist](current-parity-checklist.md) and its [registered-surface ledger](registered-surface-2026-09-28.tsv) supersede older source inventories for route coverage. They keep every registered family open until served-browser, external API and job acceptance is recorded.

## Confirmed product scope

The user confirmed on 2026-09-27 that **every inherited Plane feature must be retained**. Retirement therefore requires parity for inherited cycles, modules, inbox, imports, administration, public sharing and all other registered product flows, as well as Summon modules. Native slice receipts that explicitly omit inherited behavior are progress records, not permission to remove that behavior. Empty production data does not remove this feature-parity requirement.

The native `/core` route is an independently authenticated Convex workspace. Existing Summon and inherited Plane routes remain registered and continue to use Django. A working native slice does not establish full route or feature parity.

## Current route ownership

`apps/web/app/routes/extended.ts` still registers the legacy Summon home, projects, tasks, documents, knowledge, CRM, reports, resources, notifications, meetings, automation, assistant, credentials and settings routes. The [registered-surface ledger](registered-surface-2026-09-28.tsv) supersedes older import counts; inherited identity, issue, page and asset services still require network acceptance.

## What exists on the native path

| Domain                  | Working native owner                                                                                                              | Remaining retirement condition                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Identity and membership | Better Auth candidate, stable app user IDs, backing-session revocation, native account/preferences/image and workspace-entry APIs | Account lifecycle, recovery/SSO and all active legacy auth consumers                                 |
| Tasks and CRM           | Authorized CRUD, task properties/CAS, contacts, exact decimal values, atomic delivery handoff                                     | Remaining inherited issue contracts and route/detail parity                                          |
| Documents and meetings  | Yjs collaboration, private asset delivery/undo, metadata, meeting participants and task links                                     | Recording/transcription, summary generation, document lifecycle parity and generated artifacts       |
| Assistant and reports   | Private conversations, authenticated provider adapter, explicit task approval; bounded report contributions                       | Live provider configuration, remaining tools/attachments, full reports and export contracts          |
| Operations              | Pinned remote backend with owned HTTPS, authenticated remote browser task journey, local restore rehearsal                        | Public frontend cutover, broader remote workflow QA, Dokploy disaster recovery and scheduled backups |

Module `MIGRATION.md` files and frontend acceptance records own the detailed omissions. Work in progress is not counted as completed here.

## Convex component ownership decisions

The [component model](https://docs.convex.dev/components/understanding) keeps component tables and functions isolated from application data. A component belongs here only when its boundary preserves the existing permission, retry and public API contract.

| Journey                  | Current owner                                                                                                    | Native component decision                                                                                                                                                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Account session          | Native Better Auth owns candidate web entry/account routes; legacy auth tables remain for migration and rollback | Complete [Better Auth's React provider and session cutover](https://labs.convex.dev/better-auth/framework-guides/react) before selecting the candidate issuer remotely. The app's user IDs remain the membership and content owner.                                                  |
| Transactional mail       | Direct Resend for account OTP and email change; notification email remains open                                  | Keep immediate OTP at Better Auth's callback. Evaluate the [Resend component's durable, idempotent queue](https://www.convex.dev/components/resend) for notification digests and invitations after a verified sender, preference rules and delivery acceptance exist.                |
| Background provider jobs | Convex scheduler and app-owned status rows                                                                       | Use [Workpool](https://www.convex.dev/components/workpool) only for accepted jobs that need bounded concurrency, retry and completion state; retries require an idempotent provider operation. Cron remains the schedule owner.                                                      |
| Assistant                | App-owned conversation permissions, approved task actions and HTTP streaming                                     | [Agent](https://docs.convex.dev/agents/overview) can own message/stream persistence only after its thread and tool access model preserves existing revocation and approval behavior. Replacing the current owner during route migration would create a second conversation contract. |
| MCP                      | App-owned outbound MCP client and credential grants                                                              | The [community MCP gateway](https://www.convex.dev/components/convex-mcp-gateway) serves inbound tools, a distinct public boundary. Assess it if inbound MCP becomes an accepted product journey; it does not replace the outbound client.                                           |

The native API-key plugin is needed to preserve PATs; approval and local component schema setup remain pending. Durable mail and job components must retain recipient, retry and idempotency contracts. Installing any component alone does not close a route, job or external API gate.

## Cutover sequence

1. Close each remaining active consumer against its native public boundary; exercise its actual role and failure/recovery behavior. Replace route ownership only after preserving its supported product contract.
2. Build the complete candidate, check native TypeScript/Oxc and behavioral suites, then exercise production-served Chrome journeys and network requests. Record the exact served build and deployment URL.
3. Repeat comparable control/candidate performance cases with the same scope, fixtures, permissions and cache state. Keep current narrower first-slice results labeled directional.
4. Verify remote backup, restored code/environment, authenticated restored journeys and file delivery. Local record equality alone does not establish remote recovery.
5. Stop obsolete Django workers/API and Postgres only after proving no active consumer remains. Preserve their data volumes and a documented rollback path; volume deletion is not part of this migration.

No legacy route redirect, service removal, or data deletion has been performed merely to make these checks pass. Dated slice receipts and [backup rehearsals](backup-restore.md) remain historical evidence; only the current checklist can close a retirement gate.
