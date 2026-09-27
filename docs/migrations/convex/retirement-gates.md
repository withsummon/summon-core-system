# Django retirement gates

Status: **not ready to retire Django or its Postgres service**.

The [current parity checklist](current-parity-checklist.md) and its [registered-surface ledger](registered-surface-2026-09-28.tsv) supersede older source inventories for route coverage. They keep every registered family open until served-browser, external API and job acceptance is recorded.

## Confirmed product scope

The user confirmed on 2026-09-27 that **every inherited Plane feature must be retained**. Retirement therefore requires parity for inherited cycles, modules, inbox, imports, administration, public sharing and all other registered product flows, as well as Summon modules. Native slice receipts that explicitly omit inherited behavior are progress records, not permission to remove that behavior. Empty production data does not remove this feature-parity requirement.

The native `/core` route is an independently authenticated Convex workspace. Existing Summon and inherited Plane routes remain registered and continue to use Django. A working native slice does not establish full route or feature parity.

## Current route ownership

`apps/web/app/routes/extended.ts` still registers the legacy Summon home, projects, tasks, documents, knowledge, CRM, reports, resources, notifications, meetings, automation, assistant, credentials and settings routes. The [registered-surface ledger](registered-surface-2026-09-28.tsv) supersedes older import counts; inherited identity, issue, page and asset services still require network acceptance.

## What exists on the native path

| Domain                  | Working native owner                                                                                        | Remaining retirement condition                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Identity and membership | Convex password auth, workspace/project roles, revocation                                                   | Account lifecycle, recovery/SSO and all active legacy auth consumers                                 |
| Tasks and CRM           | Authorized CRUD, task properties/CAS, contacts, exact decimal values, atomic delivery handoff               | Remaining inherited issue contracts and route/detail parity                                          |
| Documents and meetings  | Yjs collaboration, private asset delivery/undo, metadata, meeting participants and task links               | Recording/transcription, summary generation, document lifecycle parity and generated artifacts       |
| Assistant and reports   | Private conversations, authenticated provider adapter, explicit task approval; bounded report contributions | Live provider configuration, remaining tools/attachments, full reports and export contracts          |
| Operations              | Pinned remote backend with owned HTTPS, authenticated remote browser task journey, local restore rehearsal  | Public frontend cutover, broader remote workflow QA, Dokploy disaster recovery and scheduled backups |

Module `MIGRATION.md` files and frontend acceptance records own the detailed omissions. Work in progress is not counted as completed here.

## Cutover sequence

1. Close each remaining active consumer against its native public boundary; exercise its actual role and failure/recovery behavior. Replace route ownership only after preserving its supported product contract.
2. Build the complete candidate, check native TypeScript/Oxc and behavioral suites, then exercise production-served Chrome journeys and network requests. Record the exact served build and deployment URL.
3. Repeat comparable control/candidate performance cases with the same scope, fixtures, permissions and cache state. Keep current narrower first-slice results labeled directional.
4. Verify remote backup, restored code/environment, authenticated restored journeys and file delivery. Local record equality alone does not establish remote recovery.
5. Stop obsolete Django workers/API and Postgres only after proving no active consumer remains. Preserve their data volumes and a documented rollback path; volume deletion is not part of this migration.

No legacy route redirect, service removal, or data deletion has been performed merely to make these checks pass. Dated slice receipts and [backup rehearsals](backup-restore.md) remain historical evidence; only the current checklist can close a retirement gate.
