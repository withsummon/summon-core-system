# Django retirement gates

Status: **not ready to retire Django or its Postgres service**.

## Confirmed product scope

The user confirmed on 2026-09-27 that **every inherited Plane feature must be retained**. Retirement therefore requires parity for inherited cycles, modules, inbox, imports, administration, public sharing and all other registered product flows, as well as Summon modules. Native slice receipts that explicitly omit inherited behavior are progress records, not permission to remove that behavior. Empty production data does not remove this feature-parity requirement.

The native `/core` route is an independently authenticated Convex workspace. Existing Summon and inherited Plane routes remain registered and continue to use Django. A working native slice does not establish full route or feature parity.

## Current route ownership

`apps/web/app/routes/extended.ts` still registers the legacy Summon home, projects, tasks, documents, knowledge, CRM, reports, resources, notifications, meetings, automation, assistant, credentials and settings routes. A source search on 2026-09-27 found 28 web files importing `summon.service` or `summon-plane.service`. The native `core/components/convex-core` directory has no such imports. This count is an inventory signal, not proof of network independence: inherited identity, issue, page and asset services also need tracing.

## What exists on the native path

| Domain                  | Working native owner                                                                                        | Remaining retirement condition                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Identity and membership | Convex password auth, workspace/project roles, revocation                                                   | Account lifecycle, recovery/SSO and all active legacy auth consumers                           |
| Tasks and CRM           | Authorized CRUD, task properties/CAS, contacts, exact decimal values, atomic delivery handoff               | Remaining inherited issue contracts and route/detail parity                                    |
| Documents and meetings  | Yjs collaboration, private asset delivery/undo, metadata, meeting participants and task links               | Recording/transcription, summary generation, document lifecycle parity and generated artifacts |
| Assistant and reports   | Private conversations, authenticated provider adapter, explicit task approval; bounded report contributions | Live provider configuration, remaining tools/attachments, full reports and export contracts    |
| Operations              | Pinned remote backend with owned HTTPS, authenticated remote browser task journey, local restore rehearsal  | Public frontend cutover, broader remote workflow QA and authenticated remote backup/restore    |

Module `MIGRATION.md` files and frontend acceptance records own the detailed omissions. Work in progress is not counted as completed here.

## Cutover sequence

1. Close each remaining active consumer against its native public boundary; exercise its actual role and failure/recovery behavior. Replace route ownership only after preserving its supported product contract.
2. Build the complete candidate, check native TypeScript/Oxc and behavioral suites, then exercise production-served Chrome journeys and network requests. Record the exact served build and deployment URL.
3. Repeat comparable control/candidate performance cases with the same scope, fixtures, permissions and cache state. Keep current narrower first-slice results labeled directional.
4. Verify remote backup, restored code/environment, authenticated restored journeys and file delivery. Local record equality alone does not establish remote recovery.
5. Stop obsolete Django workers/API and Postgres only after proving no active consumer remains. Preserve their data volumes and a documented rollback path; volume deletion is not part of this migration.

No legacy route redirect, service removal, or data deletion has been performed merely to make these checks pass.

## Checkpoint `8496aa7bd6` additions

Native cycles, many-to-many modules, recoverable comment deletion and project settings/archive recovery now have local role/concurrency/recovery Chrome evidence. Project archive retains children and blocks normal project operations; documents retain their independently owned access rules. Workspace role changes protect the final administrator of archived projects so recovery cannot be orphaned.

These additions do not close inherited cycle/module analytics, saved views, task lifecycle, project feature settings, public/PAT APIs or the other exclusions in module receipts. The remote owned domain still had no A record at the last DNS check, and no live provider configuration has been supplied. Existing Django/Postgres services and legacy routes remain necessary.

## Checkpoint `903cee2124` additions

Task lifecycle, quick links, intake admission/recovery and shared description history are now implemented on the native path. DNS/TLS and remote function deployment are verified; the local production frontend received remote realtime updates in Chrome. See the exact artifact and dependency-state caveat in `checkpoints/903cee2124-remote.json`. Remaining inherited behavior stays required. Remote backup/restore, public frontend deployment and full contract closure still block retirement.

## Checkpoint `5ed8c4493a` additions

Bounded project saved views are committed and remotely deployed, with live remote task-result changes verified from a production frontend served locally. Workspace views, the full rich-filter grammar and inherited layouts remain required. A remote-source snapshot was restored into an isolated local instance with code/auth configuration and successful sign-in; scheduled encrypted backups, Dokploy recovery and remote stored-file recovery remain unverified. Task attachments are the next slice and are not counted complete. These checkpoints do not authorize service retirement.
