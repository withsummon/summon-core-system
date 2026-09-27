# Full migration closure ledger

Source checkpoint: `62d2e2aa20`, inspected 2026-09-27. This is a source inventory, not a new runtime/deployment assertion. User scope requires every inherited Plane feature. No legacy route is authorized for retirement by this document. Subsequent committed coverage is reconciled below through `4f5b6aff9a`; uncommitted drafts are not counted complete. The dated checkpoint reconciliation takes precedence over older remaining-work wording below.

## Latest checkpoint reconciliation

Source inspected after `4f5b6aff9a`. These commits close bounded native contracts; they do not retire the registered Django/PAT/public/admin routes in the appendix.

| Committed evidence | Native scope now present | Remaining boundary |
| --- | --- | --- |
| `033e104f81` sidebar/favorites; `710b034dd5` recent/preferences backend; `4f5b6aff9a` personal navigation | Ordered recoverable favorites hierarchy; private recent project/task/document visits; seven personal shortcut preferences with CAS ordering and automatic default setup | Inherited sidebar consumers still use their legacy owners outside the explicitly migrated route. Recent items reauthorize targets; this is not full user activity/history or workspace analytics. |
| `be39abe18f`, `420c7ff0ff`, `40f33cc07c`, `1f96755750` | Estimate systems/points, task and private-draft selections, bounded resumable reference replacement, UI and required migrated reference fields | Inherited task/editor/REST consumers still need contract cutover; native estimates do not imply every inherited analytics/layout field is supported. |
| `2d1813d15e` | Build-selected ownership for inherited `/:workspaceSlug/stickies`, outside Django bootstrap, reusing native auth/provider and private notes | Default remains legacy unless deployment opts in. Other inherited routes, legacy UUID mapping, auth providers/recovery and complete onboarding remain separate. This is a single route-family cutover, not a global redirect. |
| `2a32edf4e1` | Private preferences/onboarding metadata sharing profile revision; authenticated last-workspace selection; explicit theme validation | Usable preferences UI and required-field cleanup were under review at this inspection and are not counted as committed here. Stored onboarding flags are not an implemented onboarding journey. Avatar/company/mobile/marketing/account identity operations remain. |
| `ddcd2f2043` | Owned authentication-session backend | Session UI/browser acceptance and password/reset/OAuth/email/account linking remain distinct. This does not claim Django session endpoint compatibility. |

Parent reports preferences additive deployment on both hosts and convergent backfills (local one changed, second zero; remote zero both scans). Raw receipts: `/tmp/summon-migration-control/preferences-{local,remote}-{1,2}.json`. This document records that supplied evidence; no independent live deployment verification was performed by its editor. Parent also reports Chrome light-theme and metadata-save acceptance; notification-density acceptance was still running.

Next cutover dependencies remain identity bootstrap/provider parity, workspace/project route scope and deep-link ID resolution, then full task-detail/layout consumers. Native address resolution is already implemented (`aa8ef219c1`); older instructions below to add that lookup are historical, while UUID/external-wire compatibility remains open. Prior suggestions to start personal stickies, drafts, reactions, links, or estimates are superseded by their later receipts. Full cycles/modules/page features, richer saved-view filtering/grouping, imports/export integrations, public boards/sharing, admin/instance features, and Summon worker/financial domains remain subject to the detailed rows and registered routes below.

## Root reconciliation through 0f51b14c25

The following supersedes older absence statements in the inventory, while preserving every remaining route/API gate.

| Committed native owner | Verified scope | Remaining scope |
| --- | --- | --- |
| `456a8515f2`, `f5b73e4bc9`, `703831033b` | Live-session authorization, profile preferences and session UI; local cross-origin revocation and preference conflict handling exercised | Full account lifecycle, inherited auth bootstrap and provider configuration |
| `23059ee446`, `d10ef09c2b`, `1ba124f050` | All ten relation directions, cross-project workspace graph and UI; remote inverse and local cross-project navigation exercised | Parent/subtask cross-project parity, all external wire contracts and broader graph capacity |
| `0b790b96c7`, `969be7e500` | Authorized workspace cycle directory; local desktop/narrow viewport and cycle deep-link acceptance | Full cycle analytics/transfer and inherited route cutover |
| `c3a7b4133e`, `af588be807`, `5879d72f13`, `720ca8c60c` | Conditional recovery/verification, email-code backend and four OAuth configurations; actual installed auth-library mocked behavior tests | Real provider/mail setup and delivery; password change/set; account linking; exact legacy attempt policy and trusted ingress throttling |
| `26acc4ba07`, `9e1b1d9b5c`, `e5709ccb89`, `b43f2cc5ea` | Document hierarchy/moves and shared project labels; local move/cycle rejection and label assignment exercised | Whole-workspace tree, historical CRDT versions, inherited route/export/full page contracts |
| `219399833d`, `9641a4096c`, `d6523a8090`, `0f51b14c25` | Existing event activity reader and atomic bulk lifecycle; local two-task Trash/restore preserves parent/relation/attachment | Complete field-diff activity coverage, bulk property/date/membership edits and inherited layouts |

Global TS7 completed 30/30 tasks after the earlier relation-label union fix. Subsequent focused backend/web checks passed for the scoped changes; later source slices are still in progress. The latest full backend run reported 445 passing tests at the magic-code checkpoint. These counts do not establish public deployment or complete feature parity. Frontend immutable remote acceptance is recorded in checkpoint-ce2efc3150.md; subsequent browser checks are local development checks unless their receipt explicitly says otherwise.

The additive label metadata migration `f943474b1b` is deployed on both hosts. One local label was updated; repeat local scan and both remote scans changed zero rows. The final group/deletion owner is not counted complete until its later commit and runtime acceptance. Django/Postgres and legacy workers remain active, and the public frontend has not been cut over.

## How to read this ledger

`Partial` means a genuine native owner exists but the stated remaining contract blocks retirement. `Legacy` means no matching native production owner was found in the inspected Convex function tree. Every row also requires route/consumer cutover: existing generated Convex functions are not replacements for the UUID/slug/session/PAT REST wire contracts. The route appendix records exact registered patterns and controller bindings, rather than treating similarly named files as proof of registration.

Paths below are repository-relative. Legacy view paths are under `apps/api/plane`; native owners are under `apps/convex/convex`; web services are under `apps/web/core/services`. Native UI is under `apps/web/core/components/convex-core`. Current `/core` is a separate authenticated application path. The inherited `apps/web/app/routes/core.ts`, Summon `routes/extended.ts`, `apps/space/app/routes.ts` and `apps/admin/app/routes.ts` remain separate route owners.

## 1. Identity, workspace and project foundations

| Feature / state | Legacy production owner and consumers | Native counterpart | Exact remaining acceptance / cutover blocker |
| --- | --- | --- | --- |
| Account authentication — Partial | `authentication/urls.py`, authentication controllers; `auth.service.ts`; sign-up, forgot/reset/set-password routes; Space auth | `auth.ts` Password provider, `identity/access.ts`, native identity query | Password recovery, email code/magic sign-in/up, Google/GitHub/GitLab/Gitea OAuth and callbacks, explicit account linking/unlinking, email change/verification, session management/revocation, password change/set, account lifecycle. Exercise token expiry, revoked sessions, recovery replay, duplicate identity and Space auth independently. Native password login alone does not replace Django session/CSRF routes. |
| Profile, onboarding, dashboard — Partial | `app/urls/user.py`, user views; `user.service.ts`, `dashboard.service.ts`; profile/settings/onboarding routes | `identity/index.ts` identity; `identity/profile.ts` private names/timezone with CAS (`289f8b5214`) | Avatar/full settings, linked accounts, onboarding/tour state, sessions, user activity/graphs, dashboard; verify visibility of another member's profile and deactivated users. Current identity projection is not profile parity. |
| Workspace administration — Partial | `app/urls/workspace.py`, `views/workspace/{base,member,invite}.py`; workspace service and settings/members routes | `workspaces/index.ts`, `settings/index.ts` | Slug availability/collision and rename propagation, full workspace CRUD/deletion, invitations/email/join/expiry, leave policy, last-visited workspace, role projections, themes, all inherited workspace settings. Existing explicit-ID grants are not an invitation flow. Keep final-admin and revoked-member invariants. |
| Projects, settings and membership — Partial | `app/urls/project.py`, `views/project/{base,member,invite}.py`; project services/settings routes | `projects/{index,settings,timezone}.ts`, `projects/create.ts`, intake settings | Invitations/join/leave; project network/visibility and discovery behavior; all feature enablement switches and consumer gating; project view/display/member preferences; identifier and external-import fields; deploy-board publication; full delete behavior. Archive/recovery and project timezone are implemented, so older notes saying these are absent are stale. |
| Personal quick links — Partial, closest closed data slice | `views/workspace/quick_link.py`, workspace quick-link REST collection/detail; workspace/home consumers | `quickLinks/index.ts`, native sidebar | Native owner CRUD and opaque metadata are implemented. Remaining boundary is legacy URL/UUID/serializer/caller replacement, and explicit removal/recovery UX policy; native soft deletion has no ordinary recovery UI. Verify old bookmarks and all quick-link callers before route cutover. |
| Stickies — Partial | `views/workspace/sticky.py`, `db/models/sticky.py`, app/API serializers; `sticky.service.ts`, `components/stickies`, sticky editor; PAT router | `stickies/*`, native personal UI (`51c0b4f828`) | Private guest CRUD, opaque representations, appearance, bounded text search/order and recovery now exist. Remaining inherited route/consumer and PAT addressing/order contracts; native search is description text, not an asserted full legacy search replacement. |
| Draft work items — Partial | `views/workspace/draft.py`, workspace draft routes; `issue/workspace_draft.service.ts`, `/:workspaceSlug/drafts` | `tasks/drafts/*`, canonical task creation, private asset pipeline (`2941884f3e`, `87b9f71938`) | Private CRUD/copy/Trash/restore and atomic idempotent publication now exist, including parent/cycle/module references, rich HTML, opaque JSON/binary and private files with independent copy bytes. Remaining inherited route/consumer, autosave-on-dismiss, estimate properties and broader asset/editor contracts; native file/copy bounds are documented product limits. Remote publication/download verified in checkpoint-87b9f71938.md. |
| Favorites, recent visits and personal preferences — Partial only saved-view favorites | `views/workspace/{favorite,recent_visit,user_preference,home}.py`, project/cycle/module/page favorite routes; favorite service, sidebar/home | `savedViews/favorites.ts`, workspace saved-view favorite endpoints | Entity-specific favorites, shared favorite folder/group/order, recent visits, home/sidebar preferences, workspace/project/user properties. Preserve per-user ownership and inaccessible/deleted target hiding; no title leaks through stale favorite rows. |

## 2. Work management and collaboration

| Feature / state | Legacy production owner and consumers | Native counterpart | Exact remaining acceptance / cutover blocker |
| --- | --- | --- | --- |
| Task CRUD and properties — Partial | `app/urls/issue.py`, `views/issue/base.py`, serializers/filter backends; issue services and project task routes | `tasks/{create,index,properties,center,states,labels}.ts` | Complete serializer fields and external IDs, estimates, label deletion/hierarchy/workspace labels, bulk operations, batch label creation, issue-date/meta/identifier lookup projections, server grouping/count/order semantics. Current bounds (catalogs, links, scan pages) are explicit product limits, not full legacy capacity parity. |
| Rich task content, history and activity — Partial | `views/issue/{version,activity}.py`, issue-version/history routes and Celery version/activity tasks; issue history/editor UI | `tasks/{description,description_content,history,rich_content,events,revision}.ts` | Full rich JSON/binary editor transport and inline attachments, legacy historical version aliases/payloads, complete actor/before-after activity timeline and event coverage. Shared coalesced description history is implemented; old receipts listing all description history as absent are stale. Confirm restore permissions independently for ordinary and triage tasks. |
| Parent/child and relation graph — Partial | `views/issue/{sub_issue,relation}.py`, issue relationship services/UI | `tasks/{hierarchy,relations}.ts` | Native same-project parent/blocks/relates/duplicate subset exists. Legacy cross-project workspace relations, remaining relation types and their inverse/scheduling semantics, graph/query projections and bulk behavior remain. Preserve current ACL redaction and writer-only removal placeholders for hidden endpoints. |
| Task archive/trash — Partial | `views/issue/archive.py`, deleted/bulk archive/delete routes | `tasks/lifecycle.ts`, canonical task access owner and cross-domain visibility checks | Native archive/soft-delete/restore preserves relations and has cross-domain tests. Remaining bulk/wire behavior, exact inherited creator exceptions, cleanup/purge/retention and lifecycle activity parity. Do not regress archived-read-only and creator/admin trash boundaries while adding other features. |
| Comments, reactions, mentions and subscribers — Partial | `views/issue/{comment,reaction,subscriber}.py`; issue comment/reaction services and subscriber UI; public/PAT controllers | `tasks/comments.ts`, `notifications/index.ts` subscriptions | Comment soft removal/recovery exists. Task reactions and recoverable external links (`97ed19f660`), comment reactions (`e40c5e2a47`) and mention recipient delivery (`0f1c6640ab`, `74e926bc6a`) now exist. Remaining public-board votes/reactions, broader subscriber management, full publication/editor semantics and external/PAT consumers. Canonical guest task/comment visibility was subsequently unified; do not carry forward the earlier blanket guest-policy omission. |
| Task/issue links — Partial | `views/issue/link.py`, `bgtasks/work_item_link_task.py`; issue links UI, PAT links | `tasks/links.ts`, native task link UI (`c9e5a1e7c3`, `97ed19f660`) | Native link CRUD, URL normalization/uniqueness, metadata preservation, current task ACL and recoverable removal exist. Remaining metadata enrichment, specific activity payloads and external/PAT addressing and response contracts. |
| Attachments and files — Partial | `views/issue/attachment.py`, `views/asset/{base,v2}.py`, FileAsset model/metadata/cleanup workers; issue attachment/file services | `assets/{taskAttachments,task_access,index,http,upload,content}.ts`, document assets and assistant attachments | Supported native task/intake upload/read/remove/restore and private authenticated bytes exist. Remaining V1 multipart, user avatars/workspace logos, static/public assets, bulk/entity contracts, inline task-editor images, metadata/previews, all legacy MIME families (Office/ODF/SVG/TIFF/BMP/audio/video/archives), per-instance size config and attachment activity. Run claim+commit revocation, expiry, orphan cleanup and restore scenarios for each added scope. |
| Intake/inbox — Partial | `app/urls/intake.py`, `views/intake/base.py`, public/PAT intake controllers; inbox services/routes | `intakes/{index,access,lifecycle}.ts`, shared task history and task attachments | Stable task ID/sequence, reserved triage, decisions/duplicate/snooze, creator/admin edit and recovery exist. Remaining custom intake configuration CRUD/view/logo/source metadata, richer task properties, triage comments/reactions, filtering/counts, email/external intake, public/PAT permission differences and inbox aliases. Never create a different task on acceptance. |
| Cycles — Partial | `app/urls/cycle.py`, cycle views/models; cycle/archive services and active-cycles UI | `cycles/{index,tasks,dates}.ts`, project timezone | Date/DST, overlap, CRUD/archive/trash/recovery, single-cycle membership and moves implemented. Remaining unfinished-task transfer with completion snapshot, progress/burndown/distributions/analytics, favorites, personal view/sort/logo/import properties, workspace active-cycle dashboard, detailed activity and REST/PAT behavior. Current 200-cycle/100-membership caps are not inherited parity. |
| Modules — Partial | `app/urls/module.py`, module views/models; module/archive services | `modules/{index,members,tasks}.ts` | Rich description, status/dates, lead/roster, many-to-many task membership and lifecycle exist. Remaining module links/favorites, detailed rich JSON/display/filter/order/logo/external fields, analytics/workspace summaries, guest-feature behavior and REST/PAT response contracts. |
| Estimates — Legacy | `app/urls/estimate.py`, `views/estimate/base.py`, estimate models/serializers; `estimate.service.ts`, project estimates settings and task properties | No estimate owner/table found | Project estimate selection, scale/point CRUD/order/defaults and permissions, task assignment/clearing, deletion of used points and analytics weighting. `api/urls/estimate.py` exists but is not imported by current PAT `urls/__init__.py`; distinguish defined source from registered endpoint. |
| Project/workspace saved views — Partial | `app/urls/views.py`, `views/view/base.py`, `utils/issue_filters.py`, complex filter backend; view/workspace services | `savedViews/{index,workspace,filters,result_page,workspaceChoices}.ts` | Both scopes now execute authorized bounded results with one evaluator; required workspace owner backfill is complete. Remaining nested/negative/null/range/relative/subscriber/cycle/module/estimate predicates, project clauses, alternate sorting/grouping/counts, board/calendar/spreadsheet/timeline layouts, display/logo/order metadata, saved private/locked data import, archive distinctions and favorite folders/recent visits. No unsupported saved filter may be silently reduced. |
| Search, workspace discovery and analytics — Partial narrow task center/reporting only | `app/urls/{search,analytic}.py`, search/analytic views, workspace user/cycle/module/taxonomy views; analytics/issue-filter/dashboard services | `tasks/center.ts`, bounded `reporting/*`, workspace taxonomy choices | Search across entity types/identifier, full-text/ranking/highlighting, inherited issue filter/order/count contracts, user profile activity/statistics, saved analytics/default/advanced charts and exports. Explicitly authorized totals must not be inferred from a loaded page. Native Summon reports are not the inherited analytics engine. |
| Pages/documents — Partial | `app/urls/page.py`, `views/page/{base,version}.py`, Page model, page transaction/version workers; project-page services/editor/live rooms | `documents/*`, `apps/live/src/convex`, editor CRDT integration | Metadata/visibility/locks/archive/trash, immutable snapshot revisions and actual Yjs collaboration exist. Remaining parent/subpage tree, labels/moves/reorder, ownership transfer, page favorites/duplicate, timed version generation/restore UX, backlinks/file extraction, legacy force-close/projections and project-admin lifecycle exceptions. Keep Yjs merge ownership, revoked-write room eviction and title consistency; HTML last-write-wins is not equivalent. |
| Notifications — Partial | `app/urls/notification.py`, notification views/model/task/email workers; workspace notification service/UI | recipient `notifications/*`, task event owner | Native preferences, count/filter and bounded filtered mark-read work now has committed owners (`df9aa63f3f` and preceding notification commits), alongside mentions and current-ACL delivery/read. Remaining all inherited event producers, email channels/digests and REST consumer cutover; bounded batches must not be described as an instantaneous global update. |

## 3. External surfaces, administration and Summon domains

| Feature / state | Legacy production owner and consumers | Native counterpart | Exact remaining acceptance / cutover blocker |
| --- | --- | --- | --- |
| Issue export jobs — Legacy | `app/urls/exporter.py`, `views/exporter/base.py`, `bgtasks/{export_task,exporter_expired_task,analytic_plot_export}.py`; project-export service, exports settings | Native report CSV only | Registered `export-issues/` is asynchronous job/history/download semantics, not report CSV. Preserve CSV/XLSX/JSON columns, filter snapshots, role redaction, signed/file access expiry, failure/retry and job history. Full request-to-download browser journey with row accuracy and file validation is required. |
| Imports/integrations — unresolved existing backend ownership | `integrations/{github,jira,integration}.service.ts`, app-installation service and integration UI reference importers/workspace-integrations | No native import owner found | No matching importer route was found in inspected registered Django URL modules. Do not invent a working legacy implementation or omit user-required feature. Resolve intended upstream/extension owner, then implement credential scope, preview/mapping, resumable/idempotent jobs, source IDs/deduplication and user-visible failures. |
| Personal API tokens and REST v1 — Legacy | `app/urls/api.py`; all registered `api/urls` modules; `api.service.ts` and token settings; external clients | No compatible HTTP API or PAT authentication owner found | Token create/list/revoke/expiry/last-use/secret display and rate limits; full method/status/envelope/pagination/error/filter semantics, UUID/slug/identifier addressing, relations/assets/invitations/stickies aliases. Convex HTTP router currently registers auth, private asset GET and assistant reply only. Generated RPC APIs and external Plane MCP credentials do not replace PATs. |
| Webhooks — Legacy | `app/urls/webhook.py`, webhook views/model, `bgtasks/webhook_task.py`; webhook service/settings/log UI | None found | Admin CRUD/secret regenerate, event selection, signature and exact payload, delivery retry/idempotency/log pagination, endpoint safety, revoked config and dead-letter visibility. Test actual receiving endpoint and credential-redacted logs before retirement. |
| Public project boards / Space — Legacy | `space/urls` and controllers, project deploy-board routes; `apps/space` routes/services | None found | Anchor publication/settings and revoke, public metadata/issues/taxonomy/members, authenticated versus anonymous comment/reaction/vote behavior, intake submit/delete, assets/restore/bulk, shared-link auth. Private native task ACL cannot simply replace publication policy. Verify publish→anonymous read→revoke across open sessions, no private content leakage. |
| Instance administration — Legacy | `license/urls.py`, instance/admin controllers; `apps/admin/app/routes.ts`, instance/app-config services | Workspace settings only; not instance authority | Instance bootstrap/admin sign-in/session/logout and final-admin policy, global configuration, email/LLM checks, OAuth provider settings, image settings, workspace creation/list and feature switches. Workspace administrators must not become instance administrators. Run installed-admin application, not merely native workspace settings. |
| CRM/delivery/projects — Partial | `summon/views/commercial.py`, commercial services/models; summon service and extended CRM/project routes | `commercial/*`, project profile and handoff | Native clients/contacts/opportunities, exact decimals/transitions and atomic delivery handoff exist. Reconcile every serializer field, archived/deleted records, list filters/projections, opportunity transition/audit semantics and old routes; receipt's supported subset is not a full external API conversion. |
| Resources and credentials — Partial | Summon collaboration/resource controllers; credential/MCP services and routes | `resources/*`, `mcp/{credentials,vault,sensitive,stepUp,invocations,client}` | Resource credential associations and native credential browser management now exist. Remaining wire routes, vault key rotation/migration, reconciliation of ambiguous/crashed external writes, live configured MCP acceptance and native MCP server exposure. Time-based expiration must reauthorize use; do not claim reactive expiry disappearance without clock invalidation. |
| Meetings/transcripts — Partial | Summon meeting services (`meeting_transcript`, `meeting_summary`, `meeting_mom`) and routes | `meetings/*`, `meetings/summary/*`, canonical document converter | Meeting CRUD/participants/task links, private text transcript and structured summary transaction exist. Remaining recordings/audio transcription, OCR/external transcript ingestion, live provider success, token accounting/export and complete legacy serializer/source flows. Failure without provider is tested; it is not successful summarization evidence. |
| Assistant — Partial | Summon assistant conversation/action/query services and routes | `assistant/*`, provider/context/action owners, authenticated reply HTTP | Private conversations, reply flow, task approval and bounded text attachments exist. Remaining all legacy action types/select/retry/cancel semantics, automatic retrieval/planning, OCR/PDF/multimodal attachments, other provider backends, usage/cost accounting, MCP orchestration and live provider acceptance. Recheck authorization after provider/remote tool responses. |
| Automation/artifacts — Partial | Summon automation/template/page-document/services; special root render/download routes | `automation/*`, shared `lib/documentConversion.ts` | Templates/jobs/preview/explicit editable-document publication exist. Remaining PDF/DOCX/XLSX/PPTX rendering/download artifacts, extraction/OCR, worker interruption/recovery, all template aliases and configured provider journeys. Native generated document is not equivalent to every generated artifact format. |
| Summon home/reporting/settings — Partial | `summon/services/{overview,reports}.py`, settings routes; Summon home/report/report-export UI | `reporting/*`, shared report aggregate/CSV UI, `settings/*` | Bounded authorized contributions/complete-coverage CSV exist; missing file/automation/activity/client-status projections, atomic report snapshot semantics, full home assembly and AI/MCP status wiring remain. No accounting ledger/invoice/expense module was found in current native owners; the user's accounting ambition must not be claimed delivered by decimal CRM values. |
| Miscellaneous external/system routes — Legacy | `app/urls/external.py`, `timezone.py`, `web/urls.py`, optional schema docs; Unsplash and AI services | Project/workspace timezone validation; assistant separate | Unsplash search/configuration, legacy editor AI endpoints, timezone catalog response and robots/root redirects/schema docs must be consciously retained or rewired. A new endpoint with a similar capability is not an exact consumer replacement. |

## 4. Dependency and route cutover sequence

1. **Finish canonical domain contracts before redirects.** Close current notification work; add independently bounded personal stickies/drafts/estimates and missing task graph/reaction/link producers; then complete cycle/module/page features and rich filtering/analytics. Add complete UI + BDD + role/failure/recovery acceptance for each. Smallest independent next slice: personal stickies, whose app owner is explicit and isolated. Preserve owner-only guest CRUD, editor content fields and persisted ordering/search; PAT sort differences belong to the later REST boundary. Do not claim parity from a metadata-only note.
2. **Close identity and configuration dependencies.** Auth recovery/OAuth/invitations/session/profile plus workspace/project feature gates and instance authority are prerequisites for changing the default entry routes. Existing explicit-ID membership grants cannot stand in for invitations. Configure and test provider/worker/artifact paths with genuine requests after their domain boundaries are ready.
3. **Add external contracts through canonical owners.** Implement PAT auth and REST method/serializer/pagination aliases, webhooks and public Space publication as distinct authority boundaries. Use existing task/document/membership transactions; do not create parallel state owners. Resolve importer ownership and implement async import/export jobs before removing their UI. Route appendix is the request-contract checklist; every binding needs contract tests and a consumer decision.
4. **Cut over complete route families and callers.** For each legacy web/admin/Space route, preserve deep links/back/forward/refresh, permissions and errors, then replace service/store calls with the canonical native boundary. Capture production-served Chrome network traces proving no Django requests for that family, including editor/live, auth, assets and error paths. A grep count is a useful inventory signal, not proof of network independence. No full inherited family in this ledger is marked ready for unconditional removal.
5. **Retire infrastructure last.** Repeat full gates and equivalent workload benchmarks on identified immutable artifacts; validate public frontend/backend/live URLs and served build identity. Exercise encrypted/scheduled backup, restore of code/config/auth/storage and authenticated file/document journeys. Inventory every remaining Celery producer and scheduled task (notifications/email, invitations/passwords, export/cleanup, activity/version/page, webhooks, storage metadata and automation). Stop Django/API/workers/Postgres only once no active caller/job remains; retain volumes and rollback instructions. Current remote snapshot/file restore evidence does not establish all scheduled recovery operations.

## Receipt reconciliation

Older receipts are append-only slice records, not the live truth table. `tasks/MIGRATION.md`'s initial omissions for hierarchy/comments/attachments/intake/cycles/modules/lifecycle are superseded by later owners. `savedViews/MIGRATION.md`'s workspace exclusion is superseded by `WORKSPACE_MIGRATION.md` and the verified two-host backfill. `assets/MIGRATION.md`'s issue/assistant attachment exclusion is superseded for supported formats/scopes. `intakes/MIGRATION.md`'s attachment omission is superseded; its triage comments and richer configuration omissions remain. `documents/MIGRATION.md`'s resource-credential/meeting-summary/automation omissions are superseded for the implemented subsets, while page-tree/version/export omissions remain. MCP receipt's browser-management omission is superseded by native credentials UI; live external integration is still a separate evidence gate. Early retirement checkpoints' missing DNS/task lifecycle/remote restore statements have later dated receipts; use the latest corresponding checkpoint, not an old paragraph.

This inventory did not run deployment, browser or test suites. It sampled current registrations, native functions/schema, public HTTP router, services/routes and module receipts. Detailed permission equivalence for unimplemented families is acceptance work, not asserted by a route listing.

## 4a. Concrete inherited-route cutover proposal (source review at `df9aa63f3f`)

**Next slice: workspace/project navigation bootstrap and the inherited identifier task-detail route.** Reuse the established inherited shell and detail composition, replacing their data consumers at explicit boundaries. Do not move the entire inherited project issue list to the narrower native list and silently lose its board/calendar/Gantt/spreadsheet/filter behavior. That list remains a later contract closure.

### Actual dependency chain and blockers

| Owner | Current dependency | Required cutover work |
| --- | --- | --- |
| `app/routes.ts`, `app/legacy-layout.tsx`, `app/provider.tsx` | `/core` is outside legacy `AppProvider`; inherited routes mount MobX stores and their session consumers | Introduce a deliberate route subtree/auth boundary for migrated consumers; a leaf Convex hook inside the current wrappers still triggers Django bootstrap. Preserve unmigrated routes explicitly, without catching native errors and falling back to Django. |
| `core/lib/wrappers/authentication-wrapper.tsx`, `core/services/auth.service.ts`, user stores | `fetchCurrentUser`, onboarding/profile/workspace preferences, Django cookie/CSRF and password/magic/reset flows | Convex `auth.ts` currently configures Password only. Define native session bootstrap and logout for migrated routes; preserve inherited authentication routes until their providers/reset/invitations/onboarding contracts migrate. Do not identify accounts by matching email or assume a Convex JWT is a Django session. |
| `core/layouts/auth-layout/workspace-wrapper.tsx`, inherited `(projects)/_sidebar.tsx` | Workspace slug, partial projects, membership roles, favorites, states and sidebar/project navigation preferences fetched via SWR/stores | Add one authorized native slug resolver and current workspace/project membership projection. Refactor shell presentation to receive those typed values. Preferences/favorites are actual dependencies, not optional empty arrays; either implement their owners for the migrated shell or leave their clearly separated legacy controls on legacy routes. |
| `core/layouts/auth-layout/project-wrapper.tsx` | Project details/roles plus eager members, properties, labels/states/intake, estimates, all cycles/modules/views | Split route bootstrap from feature-specific data loading. Existing native owners cover many of these, but estimates and full preferences do not. A detail route must not eagerly require unrelated legacy services. Preserve canonical ACL rather than synthesizing a legacy administrator role. |
| `app/(all)/[workspaceSlug]/(projects)/browse/[workItem]/page.tsx`, `core/components/browse/workItem-detail`, `core/store/issue/issue-details/*` | Identifier lookup then `TIssue`, `useIssueDetail`, `useWorkItemProperties` and nested comment/activity/attachment/reaction/relation stores | Add indexed native `(projectId,sequence)` lookup, resolve project through `(workspaceId,identifier)`, and enforce `requireTask`/intake visibility. Rewire detail composition to generated native contracts and existing native mutation owners, extracting reusable presentation from MobX-bound components. Audit every mounted subpanel: activity/estimates/full editor features remain gaps; replacing the page with `/core` detail alone is not full inherited-detail parity. |
| `.../projects/(detail)/[projectId]/issues/(detail)/[issueId]/page.tsx` | `IssueService.getIssueMetaFromURL` loader redirects UUID detail to identifier browse | Route loader needs the same authorized address owner. Native IDs and legacy UUIDs are different: no cast, guessed mapping or slug collision dispatch. Existing stored/external bookmarks need an explicit imported identity map before legacy UUID retirement. |
| `core/components/issues/issue-layouts/roots/project-layout-root.tsx`, `core/store/issue/project/*`, `core/services/issue/issue.service.ts` | Five layouts, persisted filter/display preferences, grouped pagination and rich `TIssue` relation projections | Separate next slice: implement supported inherited query/layout contracts before replacing `ProjectLayoutRoot` consumers. Native bounded newest task pagination cannot stand in for grouped counts/order or all inherited filters. |

### Smallest usable delivery and acceptance

1. Land the canonical route-address and auth-bootstrap owners first: native workspace slug, project identifier/native ID and task sequence resolution, current membership and explicit unauthenticated return path. Keep legacy UUID mapping a named migration boundary with removal condition. Test revoked membership, guest-owned visibility, archived/trash/triage addressing and identifier mismatch without title leaks.
2. Reuse workspace switcher/project navigation/header presentation with native data for an explicitly migrated workspace route branch. This is genuine consumer cutover, not another standalone `/core` screen. Preserve legacy navigation destinations for features still owned by Django, with their separate authentication requirement visible rather than implicit token bridging.
3. Close the inherited browse detail's mounted data contracts, then switch its existing page and UUID redirect loader together. Existing task mutations/comments/reactions/links/assets/history/cycle/module owners are reuse targets; inherited activity, property/estimate and editor differences must be resolved or explicitly remain on the legacy branch before claiming the route retired.
4. Browser acceptance must follow workspace selection → project navigation → identifier detail → edit/comment/link → refresh/back/deep link, guest/revocation and sign-out across tabs. Record network evidence that the migrated branch issues no Django bootstrap or detail requests. Existing legacy list/layout navigation must still work. Source-only inventory does not establish this runtime result.

This is a staged implementation proposal, not a claim that changing a route alias completes parity. The smallest immediate code change is the shared auth/address/navigation boundary; an end-to-end inherited task route cannot be declared complete until its actual mounted subpanels are accounted for.

## Registered route appendix

Generated by parsing `path`/`re_path` calls in the modules actually imported by root URL configuration and each package's `urls/__init__.py`. Counts are route declarations, **not** unique expanded HTTP operations or feature completion percentages. Controller method maps are included where declared. APIView-inherited methods and DRF router-generated methods must be read from their controller. Optional root schema/debug routes are conditional. `api/urls/estimate.py` and `api/urls/schema.py` are present but not imported in the current PAT registry and are deliberately excluded from registered counts.

| Registered surface | Path declarations |
| --- | ---: |
| app | 233 |
| api | 69 |
| space | 25 |
| authentication | 37 |
| license | 15 |
| summon | 48 |
| web | 2 |

Root additionally registers the two special Summon render/download paths before the app include:

```text
/api/workspaces/<str:slug>/summon/automation-jobs/<uuid:job_id>/render/ -> AutomationRenderView
/api/workspaces/<str:slug>/summon/generated-artifacts/<uuid:artifact_id>/download/ -> GeneratedArtifactDownloadView
```

### `apps/api/plane/app/urls/analytic.py` — 13 declarations

```text
/api/workspaces/<str:slug>/analytics/ -> AnalyticsEndpoint.as_view()
/api/workspaces/<str:slug>/analytic-view/ -> AnalyticViewViewset.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/analytic-view/<uuid:pk>/ -> AnalyticViewViewset.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/saved-analytic-view/<uuid:analytic_id>/ -> SavedAnalyticEndpoint.as_view()
/api/workspaces/<str:slug>/export-analytics/ -> ExportAnalyticsEndpoint.as_view()
/api/workspaces/<str:slug>/default-analytics/ -> DefaultAnalyticsEndpoint.as_view()
/api/workspaces/<str:slug>/project-stats/ -> ProjectStatsEndpoint.as_view()
/api/workspaces/<str:slug>/advance-analytics/ -> AdvanceAnalyticsEndpoint.as_view()
/api/workspaces/<str:slug>/advance-analytics-stats/ -> AdvanceAnalyticsStatsEndpoint.as_view()
/api/workspaces/<str:slug>/advance-analytics-charts/ -> AdvanceAnalyticsChartEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/advance-analytics/ -> ProjectAdvanceAnalyticsEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/advance-analytics-stats/ -> ProjectAdvanceAnalyticsStatsEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/advance-analytics-charts/ -> ProjectAdvanceAnalyticsChartEndpoint.as_view()
```

### `apps/api/plane/app/urls/api.py` — 2 declarations

```text
/api/users/api-tokens/ -> ApiTokenEndpoint.as_view()
/api/users/api-tokens/<uuid:pk>/ -> ApiTokenEndpoint.as_view()
```

### `apps/api/plane/app/urls/asset.py` — 18 declarations

```text
/api/workspaces/<str:slug>/file-assets/ -> FileAssetEndpoint.as_view()
/api/workspaces/file-assets/<uuid:workspace_id>/<str:asset_key>/ -> FileAssetEndpoint.as_view()
/api/users/file-assets/ -> UserAssetsEndpoint.as_view()
/api/users/file-assets/<str:asset_key>/ -> UserAssetsEndpoint.as_view()
/api/workspaces/file-assets/<uuid:workspace_id>/<str:asset_key>/restore/ -> FileAssetViewSet.as_view({'post': 'restore'})
/api/assets/v2/workspaces/<str:slug>/ -> WorkspaceFileAssetEndpoint.as_view()
/api/assets/v2/workspaces/<str:slug>/<uuid:asset_id>/ -> WorkspaceFileAssetEndpoint.as_view()
/api/assets/v2/user-assets/ -> UserAssetsV2Endpoint.as_view()
/api/assets/v2/user-assets/<uuid:asset_id>/ -> UserAssetsV2Endpoint.as_view()
/api/assets/v2/workspaces/<str:slug>/restore/<uuid:asset_id>/ -> AssetRestoreEndpoint.as_view()
/api/assets/v2/static/<uuid:asset_id>/ -> StaticFileAssetEndpoint.as_view()
/api/assets/v2/workspaces/<str:slug>/projects/<uuid:project_id>/ -> ProjectAssetEndpoint.as_view()
/api/assets/v2/workspaces/<str:slug>/projects/<uuid:project_id>/<uuid:pk>/ -> ProjectAssetEndpoint.as_view()
/api/assets/v2/workspaces/<str:slug>/projects/<uuid:project_id>/<uuid:entity_id>/bulk/ -> ProjectBulkAssetEndpoint.as_view()
/api/assets/v2/workspaces/<str:slug>/check/<uuid:asset_id>/ -> AssetCheckEndpoint.as_view()
/api/assets/v2/workspaces/<str:slug>/duplicate-assets/<uuid:asset_id>/ -> DuplicateAssetEndpoint.as_view()
/api/assets/v2/workspaces/<str:slug>/download/<uuid:asset_id>/ -> WorkspaceAssetDownloadEndpoint.as_view()
/api/assets/v2/workspaces/<str:slug>/projects/<uuid:project_id>/download/<uuid:asset_id>/ -> ProjectAssetDownloadEndpoint.as_view()
```

### `apps/api/plane/app/urls/cycle.py` — 14 declarations

```text
/api/workspaces/<str:slug>/projects/<uuid:project_id>/cycles/ -> CycleViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/cycles/<uuid:pk>/ -> CycleViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/cycles/<uuid:cycle_id>/cycle-issues/ -> CycleIssueViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/cycles/<uuid:cycle_id>/cycle-issues/<uuid:issue_id>/ -> CycleIssueViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/cycles/date-check/ -> CycleDateCheckEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/user-favorite-cycles/ -> CycleFavoriteViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/user-favorite-cycles/<uuid:cycle_id>/ -> CycleFavoriteViewSet.as_view({'delete': 'destroy'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/cycles/<uuid:cycle_id>/transfer-issues/ -> TransferCycleIssueEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/cycles/<uuid:cycle_id>/user-properties/ -> CycleUserPropertiesEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/cycles/<uuid:cycle_id>/archive/ -> CycleArchiveUnarchiveEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/archived-cycles/ -> CycleArchiveUnarchiveEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/archived-cycles/<uuid:pk>/ -> CycleArchiveUnarchiveEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/cycles/<uuid:cycle_id>/progress/ -> CycleProgressEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/cycles/<uuid:cycle_id>/analytics/ -> CycleAnalyticsEndpoint.as_view()
```

### `apps/api/plane/app/urls/estimate.py` — 5 declarations

```text
/api/workspaces/<str:slug>/projects/<uuid:project_id>/project-estimates/ -> ProjectEstimatePointEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/estimates/ -> BulkEstimatePointEndpoint.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/estimates/<uuid:estimate_id>/ -> BulkEstimatePointEndpoint.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/estimates/<uuid:estimate_id>/estimate-points/ -> EstimatePointEndpoint.as_view({'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/estimates/<uuid:estimate_id>/estimate-points/<estimate_point_id>/ -> EstimatePointEndpoint.as_view({'patch': 'partial_update', 'delete': 'destroy'})
```

### `apps/api/plane/app/urls/external.py` — 3 declarations

```text
/api/unsplash/ -> UnsplashEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/ai-assistant/ -> GPTIntegrationEndpoint.as_view()
/api/workspaces/<str:slug>/ai-assistant/ -> WorkspaceGPTIntegrationEndpoint.as_view()
```

### `apps/api/plane/app/urls/intake.py` — 10 declarations

```text
/api/workspaces/<str:slug>/projects/<uuid:project_id>/intakes/ -> IntakeViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/intakes/<uuid:pk>/ -> IntakeViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/intake-issues/ -> IntakeIssueViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/intake-issues/<uuid:pk>/ -> IntakeIssueViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/inboxes/ -> IntakeViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/inboxes/<uuid:pk>/ -> IntakeViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/inbox-issues/ -> IntakeIssueViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/inbox-issues/<uuid:pk>/ -> IntakeIssueViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/intake-work-items/<uuid:work_item_id>/description-versions/ -> IntakeWorkItemDescriptionVersionEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/intake-work-items/<uuid:work_item_id>/description-versions/<uuid:pk>/ -> IntakeWorkItemDescriptionVersionEndpoint.as_view()
```

### `apps/api/plane/app/urls/issue.py` — 40 declarations

```text
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issues/list/ -> IssueListEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issues/ -> IssueViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issues-detail/ -> IssueDetailEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/v2/issues/ -> IssuePaginatedViewSet.as_view({'get': 'list'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:pk>/ -> IssueViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issue-labels/ -> LabelViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issue-labels/<uuid:pk>/ -> LabelViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/bulk-create-labels/ -> BulkCreateIssueLabelsEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/bulk-delete-issues/ -> BulkDeleteIssuesEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/bulk-archive-issues/ -> BulkArchiveIssuesEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/sub-issues/ -> SubIssuesEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/issue-links/ -> IssueLinkViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/issue-links/<uuid:pk>/ -> IssueLinkViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/issue-attachments/ -> IssueAttachmentEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/issue-attachments/<uuid:pk>/ -> IssueAttachmentEndpoint.as_view()
/api/assets/v2/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/attachments/ -> IssueAttachmentV2Endpoint.as_view()
/api/assets/v2/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/attachments/<uuid:pk>/ -> IssueAttachmentV2Endpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/history/ -> IssueActivityEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/comments/ -> IssueCommentViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/comments/<uuid:pk>/ -> IssueCommentViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/issue-subscribers/ -> IssueSubscriberViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/issue-subscribers/<uuid:subscriber_id>/ -> IssueSubscriberViewSet.as_view({'delete': 'destroy'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/subscribe/ -> IssueSubscriberViewSet.as_view({'get': 'subscription_status', 'post': 'subscribe', 'delete': 'unsubscribe'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/reactions/ -> IssueReactionViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/reactions/<str:reaction_code>/ -> IssueReactionViewSet.as_view({'delete': 'destroy'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/comments/<uuid:comment_id>/reactions/ -> CommentReactionViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/comments/<uuid:comment_id>/reactions/<str:reaction_code>/ -> CommentReactionViewSet.as_view({'delete': 'destroy'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/user-properties/ -> ProjectUserDisplayPropertyEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/archived-issues/ -> IssueArchiveViewSet.as_view({'get': 'list'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:pk>/archive/ -> IssueArchiveViewSet.as_view({'get': 'retrieve', 'post': 'archive', 'delete': 'unarchive'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/issue-relation/ -> IssueRelationViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/remove-relation/ -> IssueRelationViewSet.as_view({'post': 'remove_relation'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/deleted-issues/ -> DeletedIssuesListViewSet.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issue-dates/ -> IssueBulkUpdateDateEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/versions/ -> IssueVersionEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/versions/<uuid:pk>/ -> IssueVersionEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:work_item_id>/description-versions/ -> WorkItemDescriptionVersionEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:work_item_id>/description-versions/<uuid:pk>/ -> WorkItemDescriptionVersionEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/meta/ -> IssueMetaEndpoint.as_view()
/api/workspaces/<str:slug>/work-items/<str:project_identifier>-<str:issue_identifier>/ -> IssueDetailIdentifierEndpoint.as_view()
```

### `apps/api/plane/app/urls/module.py` — 13 declarations

```text
/api/workspaces/<str:slug>/projects/<uuid:project_id>/modules/ -> ModuleViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/modules/<uuid:pk>/ -> ModuleViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/modules/ -> ModuleIssueViewSet.as_view({'post': 'create_issue_modules'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/modules/<uuid:module_id>/issues/ -> ModuleIssueViewSet.as_view({'post': 'create_module_issues', 'get': 'list'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/modules/<uuid:module_id>/issues/<uuid:issue_id>/ -> ModuleIssueViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/modules/<uuid:module_id>/module-links/ -> ModuleLinkViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/modules/<uuid:module_id>/module-links/<uuid:pk>/ -> ModuleLinkViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/user-favorite-modules/ -> ModuleFavoriteViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/user-favorite-modules/<uuid:module_id>/ -> ModuleFavoriteViewSet.as_view({'delete': 'destroy'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/modules/<uuid:module_id>/user-properties/ -> ModuleUserPropertiesEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/modules/<uuid:module_id>/archive/ -> ModuleArchiveUnarchiveEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/archived-modules/ -> ModuleArchiveUnarchiveEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/archived-modules/<uuid:pk>/ -> ModuleArchiveUnarchiveEndpoint.as_view()
```

### `apps/api/plane/app/urls/notification.py` — 7 declarations

```text
/api/workspaces/<str:slug>/users/notifications/ -> NotificationViewSet.as_view({'get': 'list'})
/api/workspaces/<str:slug>/users/notifications/<uuid:pk>/ -> NotificationViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/users/notifications/<uuid:pk>/read/ -> NotificationViewSet.as_view({'post': 'mark_read', 'delete': 'mark_unread'})
/api/workspaces/<str:slug>/users/notifications/<uuid:pk>/archive/ -> NotificationViewSet.as_view({'post': 'archive', 'delete': 'unarchive'})
/api/workspaces/<str:slug>/users/notifications/unread/ -> UnreadNotificationEndpoint.as_view()
/api/workspaces/<str:slug>/users/notifications/mark-all-read/ -> MarkAllReadNotificationViewSet.as_view({'post': 'create'})
/api/users/me/notification-preferences/ -> UserNotificationPreferenceEndpoint.as_view()
```

### `apps/api/plane/app/urls/page.py` — 11 declarations

```text
/api/workspaces/<str:slug>/projects/<uuid:project_id>/pages-summary/ -> PageViewSet.as_view({'get': 'summary'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/pages/ -> PageViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/ -> PageViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/favorite-pages/<uuid:page_id>/ -> PageFavoriteViewSet.as_view({'post': 'create', 'delete': 'destroy'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/archive/ -> PageViewSet.as_view({'post': 'archive', 'delete': 'unarchive'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/lock/ -> PageViewSet.as_view({'post': 'lock', 'delete': 'unlock'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/access/ -> PageViewSet.as_view({'post': 'access'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/description/ -> PagesDescriptionViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/versions/ -> PageVersionEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/versions/<uuid:pk>/ -> PageVersionEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:page_id>/duplicate/ -> PageDuplicateEndpoint.as_view()
```

### `apps/api/plane/app/urls/project.py` — 20 declarations

```text
/api/workspaces/<str:slug>/projects/ -> ProjectViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/details/ -> ProjectViewSet.as_view({'get': 'list_detail'})
/api/workspaces/<str:slug>/projects/<uuid:pk>/ -> ProjectViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/project-identifiers/ -> ProjectIdentifierEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/invitations/ -> ProjectInvitationsViewset.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/invitations/<uuid:pk>/ -> ProjectInvitationsViewset.as_view({'get': 'retrieve', 'delete': 'destroy'})
/api/users/me/workspaces/<str:slug>/projects/invitations/ -> UserProjectInvitationsViewset.as_view({'get': 'list', 'post': 'create'})
/api/users/me/workspaces/<str:slug>/project-roles/ -> UserProjectRolesEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/join/<uuid:pk>/ -> ProjectJoinEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/members/ -> ProjectMemberViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/members/<uuid:pk>/ -> ProjectMemberViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/members/leave/ -> ProjectMemberViewSet.as_view({'post': 'leave'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/project-views/ -> ProjectUserViewsEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/project-members/me/ -> ProjectMemberUserEndpoint.as_view()
/api/workspaces/<str:slug>/user-favorite-projects/ -> ProjectFavoritesViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/user-favorite-projects/<uuid:project_id>/ -> ProjectFavoritesViewSet.as_view({'delete': 'destroy'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/project-deploy-boards/ -> DeployBoardViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/project-deploy-boards/<uuid:pk>/ -> DeployBoardViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/archive/ -> ProjectArchiveUnarchiveEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/preferences/member/<uuid:member_id>/ -> ProjectMemberPreferenceEndpoint.as_view()
```

### `apps/api/plane/app/urls/search.py` — 3 declarations

```text
/api/workspaces/<str:slug>/search/ -> GlobalSearchEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/search-issues/ -> IssueSearchEndpoint.as_view()
/api/workspaces/<str:slug>/entity-search/ -> SearchEndpoint.as_view()
```

### `apps/api/plane/app/urls/state.py` — 4 declarations

```text
/api/workspaces/<str:slug>/projects/<uuid:project_id>/states/ -> StateViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/states/<uuid:pk>/ -> StateViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/intake-state/ -> IntakeStateEndpoint.as_view()
/api/workspaces/<str:slug>/projects/<uuid:project_id>/states/<uuid:pk>/mark-default/ -> StateViewSet.as_view({'post': 'mark_as_default'})
```

### `apps/api/plane/app/urls/user.py` — 16 declarations

```text
/api/users/me/ -> UserEndpoint.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'deactivate'})
/api/users/session/ -> UserSessionEndpoint.as_view()
/api/users/me/settings/ -> UserEndpoint.as_view({'get': 'retrieve_user_settings'})
/api/users/me/email/generate-code/ -> UserEndpoint.as_view({'post': 'generate_email_verification_code'})
/api/users/me/email/ -> UserEndpoint.as_view({'patch': 'update_email'})
/api/users/me/profile/ -> ProfileEndpoint.as_view()
/api/users/me/accounts/ -> AccountEndpoint.as_view()
/api/users/me/accounts/<uuid:pk>/ -> AccountEndpoint.as_view()
/api/users/me/instance-admin/ -> UserEndpoint.as_view({'get': 'retrieve_instance_admin'})
/api/users/me/onboard/ -> UpdateUserOnBoardedEndpoint.as_view()
/api/users/me/tour-completed/ -> UpdateUserTourCompletedEndpoint.as_view()
/api/users/me/activities/ -> UserActivityEndpoint.as_view()
/api/users/me/workspaces/ -> UserWorkSpacesEndpoint.as_view()
/api/users/me/workspaces/<str:slug>/activity-graph/ -> UserActivityGraphEndpoint.as_view()
/api/users/me/workspaces/<str:slug>/issues-completed-graph/ -> UserIssueCompletedGraphEndpoint.as_view()
/api/users/me/workspaces/<str:slug>/dashboard/ -> UserWorkspaceDashboardEndpoint.as_view()
```

### `apps/api/plane/app/urls/views.py` — 7 declarations

```text
/api/workspaces/<str:slug>/projects/<uuid:project_id>/views/ -> IssueViewViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/views/<uuid:pk>/ -> IssueViewViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/views/ -> WorkspaceViewViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/views/<uuid:pk>/ -> WorkspaceViewViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/issues/ -> WorkspaceViewIssuesViewSet.as_view({'get': 'list'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/user-favorite-views/ -> IssueViewFavoriteViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/projects/<uuid:project_id>/user-favorite-views/<uuid:view_id>/ -> IssueViewFavoriteViewSet.as_view({'delete': 'destroy'})
```

### `apps/api/plane/app/urls/webhook.py` — 4 declarations

```text
/api/workspaces/<str:slug>/webhooks/ -> WebhookEndpoint.as_view()
/api/workspaces/<str:slug>/webhooks/<uuid:pk>/ -> WebhookEndpoint.as_view()
/api/workspaces/<str:slug>/webhooks/<uuid:pk>/regenerate/ -> WebhookSecretRegenerateEndpoint.as_view()
/api/workspaces/<str:slug>/webhook-logs/<uuid:webhook_id>/ -> WebhookLogsEndpoint.as_view()
```

### `apps/api/plane/app/urls/workspace.py` — 41 declarations

```text
/api/workspace-slug-check/ -> WorkSpaceAvailabilityCheckEndpoint.as_view()
/api/workspaces/ -> WorkSpaceViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/ -> WorkSpaceViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/invitations/ -> WorkspaceInvitationsViewset.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/invitations/<uuid:pk>/ -> WorkspaceInvitationsViewset.as_view({'delete': 'destroy', 'get': 'retrieve', 'patch': 'partial_update'})
/api/users/me/workspaces/invitations/ -> UserWorkspaceInvitationsViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/invitations/<uuid:pk>/join/ -> WorkspaceJoinEndpoint.as_view()
/api/workspaces/<str:slug>/members/ -> WorkSpaceMemberViewSet.as_view({'get': 'list'})
/api/workspaces/<str:slug>/project-members/ -> WorkspaceProjectMemberEndpoint.as_view()
/api/workspaces/<str:slug>/members/<uuid:pk>/ -> WorkSpaceMemberViewSet.as_view({'patch': 'partial_update', 'delete': 'destroy', 'get': 'retrieve'})
/api/workspaces/<str:slug>/members/leave/ -> WorkSpaceMemberViewSet.as_view({'post': 'leave'})
/api/users/last-visited-workspace/ -> UserLastProjectWithWorkspaceEndpoint.as_view()
/api/workspaces/<str:slug>/workspace-members/me/ -> WorkspaceMemberUserEndpoint.as_view()
/api/workspaces/<str:slug>/workspace-views/ -> WorkspaceMemberUserViewsEndpoint.as_view()
/api/workspaces/<str:slug>/workspace-themes/ -> WorkspaceThemeViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/workspace-themes/<uuid:pk>/ -> WorkspaceThemeViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/user-stats/<uuid:user_id>/ -> WorkspaceUserProfileStatsEndpoint.as_view()
/api/workspaces/<str:slug>/user-activity/<uuid:user_id>/ -> WorkspaceUserActivityEndpoint.as_view()
/api/workspaces/<str:slug>/user-activity/<uuid:user_id>/export/ -> ExportWorkspaceUserActivityEndpoint.as_view()
/api/workspaces/<str:slug>/user-profile/<uuid:user_id>/ -> WorkspaceUserProfileEndpoint.as_view()
/api/workspaces/<str:slug>/user-issues/<uuid:user_id>/ -> WorkspaceUserProfileIssuesEndpoint.as_view()
/api/workspaces/<str:slug>/labels/ -> WorkspaceLabelsEndpoint.as_view()
/api/workspaces/<str:slug>/user-properties/ -> WorkspaceUserPropertiesEndpoint.as_view()
/api/workspaces/<str:slug>/states/ -> WorkspaceStatesEndpoint.as_view()
/api/workspaces/<str:slug>/estimates/ -> WorkspaceEstimatesEndpoint.as_view()
/api/workspaces/<str:slug>/modules/ -> WorkspaceModulesEndpoint.as_view()
/api/workspaces/<str:slug>/cycles/ -> WorkspaceCyclesEndpoint.as_view()
/api/workspaces/<str:slug>/user-favorites/ -> WorkspaceFavoriteEndpoint.as_view()
/api/workspaces/<str:slug>/user-favorites/<uuid:favorite_id>/ -> WorkspaceFavoriteEndpoint.as_view()
/api/workspaces/<str:slug>/user-favorites/<uuid:favorite_id>/group/ -> WorkspaceFavoriteGroupEndpoint.as_view()
/api/workspaces/<str:slug>/draft-issues/ -> WorkspaceDraftIssueViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/draft-issues/<uuid:pk>/ -> WorkspaceDraftIssueViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/draft-to-issue/<uuid:draft_id>/ -> WorkspaceDraftIssueViewSet.as_view({'post': 'create_draft_to_issue'})
/api/workspaces/<str:slug>/quick-links/ -> QuickLinkViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/quick-links/<uuid:pk>/ -> QuickLinkViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/home-preferences/ -> WorkspaceHomePreferenceViewSet.as_view()
/api/workspaces/<str:slug>/home-preferences/<str:key>/ -> WorkspaceHomePreferenceViewSet.as_view()
/api/workspaces/<str:slug>/recent-visits/ -> UserRecentVisitViewSet.as_view({'get': 'list'})
/api/workspaces/<str:slug>/stickies/ -> WorkspaceStickyViewSet.as_view({'get': 'list', 'post': 'create'})
/api/workspaces/<str:slug>/stickies/<uuid:pk>/ -> WorkspaceStickyViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'})
/api/workspaces/<str:slug>/sidebar-preferences/ -> WorkspaceUserPreferenceViewSet.as_view()
```

### `apps/api/plane/app/urls/timezone.py` — 1 declarations

```text
/api/timezones/ -> TimezoneEndpoint.as_view()
```

### `apps/api/plane/app/urls/exporter.py` — 1 declarations

```text
/api/workspaces/<str:slug>/export-issues/ -> ExportIssuesEndpoint.as_view()
```

### `apps/api/plane/api/urls/asset.py` — 6 declarations

```text
/api/v1/assets/user-assets/ -> UserAssetEndpoint.as_view(http_method_names=['post'])
/api/v1/assets/user-assets/<uuid:asset_id>/ -> UserAssetEndpoint.as_view(http_method_names=['patch', 'delete'])
/api/v1/assets/user-assets/server/ -> UserServerAssetEndpoint.as_view(http_method_names=['post'])
/api/v1/assets/user-assets/<uuid:asset_id>/server/ -> UserServerAssetEndpoint.as_view(http_method_names=['patch', 'delete'])
/api/v1/workspaces/<str:slug>/assets/ -> GenericAssetEndpoint.as_view(http_method_names=['post'])
/api/v1/workspaces/<str:slug>/assets/<uuid:asset_id>/ -> GenericAssetEndpoint.as_view(http_method_names=['get', 'patch'])
```

### `apps/api/plane/api/urls/cycle.py` — 9 declarations

```text
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/cycles/ -> CycleListCreateAPIEndpoint.as_view(http_method_names=['get', 'post'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/cycles-lite/ -> CycleListLiteAPIEndpoint.as_view(http_method_names=['get'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/cycles/<uuid:pk>/ -> CycleDetailAPIEndpoint.as_view(http_method_names=['get', 'patch', 'delete'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/cycles/<uuid:cycle_id>/cycle-issues/ -> CycleIssueListCreateAPIEndpoint.as_view(http_method_names=['get', 'post'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/cycles/<uuid:cycle_id>/cycle-issues/<uuid:issue_id>/ -> CycleIssueDetailAPIEndpoint.as_view(http_method_names=['get', 'delete'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/cycles/<uuid:cycle_id>/transfer-issues/ -> TransferCycleIssueAPIEndpoint.as_view(http_method_names=['post'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/cycles/<uuid:cycle_id>/archive/ -> CycleArchiveUnarchiveAPIEndpoint.as_view(http_method_names=['post'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/archived-cycles/ -> CycleArchiveUnarchiveAPIEndpoint.as_view(http_method_names=['get'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/archived-cycles/<uuid:cycle_id>/unarchive/ -> CycleArchiveUnarchiveAPIEndpoint.as_view(http_method_names=['delete'])
```

### `apps/api/plane/api/urls/intake.py` — 2 declarations

```text
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/intake-issues/ -> IntakeIssueListCreateAPIEndpoint.as_view(http_method_names=['get', 'post'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/intake-issues/<uuid:issue_id>/ -> IntakeIssueDetailAPIEndpoint.as_view(http_method_names=['get', 'patch', 'delete'])
```

### `apps/api/plane/api/urls/label.py` — 2 declarations

```text
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/labels/ -> LabelListCreateAPIEndpoint.as_view(http_method_names=['get', 'post'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/labels/<uuid:pk>/ -> LabelDetailAPIEndpoint.as_view(http_method_names=['get', 'patch', 'delete'])
```

### `apps/api/plane/api/urls/member.py` — 7 declarations

```text
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/members/ -> ProjectMemberListCreateAPIEndpoint.as_view(http_method_names=['get', 'post'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/members/<uuid:pk>/ -> ProjectMemberDetailAPIEndpoint.as_view(http_method_names=['patch', 'delete', 'get'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/project-members/ -> ProjectMemberListCreateAPIEndpoint.as_view(http_method_names=['get', 'post'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/project-members-lite/ -> ProjectMemberLiteAPIEndpoint.as_view(http_method_names=['get'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/project-members/<uuid:pk>/ -> ProjectMemberDetailAPIEndpoint.as_view(http_method_names=['patch', 'delete', 'get'])
/api/v1/workspaces/<str:slug>/members/ -> WorkspaceMemberAPIEndpoint.as_view(http_method_names=['get'])
/api/v1/workspaces/<str:slug>/members-lite/ -> WorkspaceMemberLiteAPIEndpoint.as_view(http_method_names=['get'])
```

### `apps/api/plane/api/urls/module.py` — 8 declarations

```text
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/modules/ -> ModuleListCreateAPIEndpoint.as_view(http_method_names=['get', 'post'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/modules-lite/ -> ModuleListLiteAPIEndpoint.as_view(http_method_names=['get'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/modules/<uuid:pk>/ -> ModuleDetailAPIEndpoint.as_view(http_method_names=['get', 'patch', 'delete'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/modules/<uuid:module_id>/module-issues/ -> ModuleIssueListCreateAPIEndpoint.as_view(http_method_names=['get', 'post'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/modules/<uuid:module_id>/module-issues/<uuid:issue_id>/ -> ModuleIssueDetailAPIEndpoint.as_view(http_method_names=['delete'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/modules/<uuid:pk>/archive/ -> ModuleArchiveUnarchiveAPIEndpoint.as_view(http_method_names=['post'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/archived-modules/ -> ModuleArchiveUnarchiveAPIEndpoint.as_view(http_method_names=['get'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/archived-modules/<uuid:pk>/unarchive/ -> ModuleArchiveUnarchiveAPIEndpoint.as_view(http_method_names=['delete'])
```

### `apps/api/plane/api/urls/project.py` — 5 declarations

```text
/api/v1/workspaces/<str:slug>/projects/ -> ProjectListCreateAPIEndpoint.as_view(http_method_names=['get', 'post'])
/api/v1/workspaces/<str:slug>/projects-lite/ -> ProjectListLiteAPIEndpoint.as_view(http_method_names=['get'])
/api/v1/workspaces/<str:slug>/projects/<uuid:pk>/ -> ProjectDetailAPIEndpoint.as_view(http_method_names=['get', 'patch', 'delete'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/archive/ -> ProjectArchiveUnarchiveAPIEndpoint.as_view(http_method_names=['post', 'delete'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/summary/ -> ProjectSummaryAPIEndpoint.as_view(http_method_names=['get'])
```

### `apps/api/plane/api/urls/state.py` — 2 declarations

```text
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/states/ -> StateListCreateAPIEndpoint.as_view(http_method_names=['get', 'post'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/states/<uuid:state_id>/ -> StateDetailAPIEndpoint.as_view(http_method_names=['get', 'patch', 'delete'])
```

### `apps/api/plane/api/urls/user.py` — 1 declarations

```text
/api/v1/users/me/ -> UserEndpoint.as_view(http_method_names=['get'])
```

### `apps/api/plane/api/urls/work_item.py` — 25 declarations

```text
/api/v1/workspaces/<str:slug>/issues/search/ -> IssueSearchEndpoint.as_view(http_method_names=['get'])
/api/v1/workspaces/<str:slug>/issues/<str:project_identifier>-<str:issue_identifier>/ -> WorkspaceIssueAPIEndpoint.as_view(http_method_names=['get'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/issues/ -> IssueListCreateAPIEndpoint.as_view(http_method_names=['get', 'post'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:pk>/ -> IssueDetailAPIEndpoint.as_view(http_method_names=['get', 'patch', 'delete'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/links/ -> IssueLinkListCreateAPIEndpoint.as_view(http_method_names=['get', 'post'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/links/<uuid:pk>/ -> IssueLinkDetailAPIEndpoint.as_view(http_method_names=['get', 'patch', 'delete'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/comments/ -> IssueCommentListCreateAPIEndpoint.as_view(http_method_names=['get', 'post'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/comments/<uuid:pk>/ -> IssueCommentDetailAPIEndpoint.as_view(http_method_names=['get', 'patch', 'delete'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/activities/ -> IssueActivityListAPIEndpoint.as_view(http_method_names=['get'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/activities/<uuid:pk>/ -> IssueActivityDetailAPIEndpoint.as_view(http_method_names=['get'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/issue-attachments/ -> IssueAttachmentListCreateAPIEndpoint.as_view(http_method_names=['get', 'post'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/issue-attachments/<uuid:pk>/ -> IssueAttachmentDetailAPIEndpoint.as_view(http_method_names=['get', 'patch', 'delete'])
/api/v1/workspaces/<str:slug>/work-items/search/ -> IssueSearchEndpoint.as_view(http_method_names=['get'])
/api/v1/workspaces/<str:slug>/work-items/<str:project_identifier>-<str:issue_identifier>/ -> WorkspaceIssueAPIEndpoint.as_view(http_method_names=['get'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/work-items/ -> IssueListCreateAPIEndpoint.as_view(http_method_names=['get', 'post'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:pk>/ -> IssueDetailAPIEndpoint.as_view(http_method_names=['get', 'patch', 'delete'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/links/ -> IssueLinkListCreateAPIEndpoint.as_view(http_method_names=['get', 'post'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/links/<uuid:pk>/ -> IssueLinkDetailAPIEndpoint.as_view(http_method_names=['get', 'patch', 'delete'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/comments/ -> IssueCommentListCreateAPIEndpoint.as_view(http_method_names=['get', 'post'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/comments/<uuid:pk>/ -> IssueCommentDetailAPIEndpoint.as_view(http_method_names=['get', 'patch', 'delete'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/activities/ -> IssueActivityListAPIEndpoint.as_view(http_method_names=['get'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/activities/<uuid:pk>/ -> IssueActivityDetailAPIEndpoint.as_view(http_method_names=['get'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/attachments/ -> IssueAttachmentListCreateAPIEndpoint.as_view(http_method_names=['get', 'post'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/attachments/<uuid:pk>/ -> IssueAttachmentDetailAPIEndpoint.as_view(http_method_names=['get', 'patch', 'delete'])
/api/v1/workspaces/<str:slug>/projects/<uuid:project_id>/work-items/<uuid:issue_id>/relations/ -> IssueRelationListCreateAPIEndpoint.as_view(http_method_names=['get', 'post'])
```

### `apps/api/plane/api/urls/invite.py` — 1 declarations

```text
/api/v1/workspaces/<str:slug>/ -> include(router.urls)
```

Router registration: `router.register('invitations', WorkspaceInvitationsViewset, basename='workspace-invitations')`. This expands collection/detail URLs under the included workspace prefix.

### `apps/api/plane/api/urls/sticky.py` — 1 declarations

```text
/api/v1/workspaces/<str:slug>/ -> include(router.urls)
```

Router registration: `router.register('stickies', StickyViewSet, basename='workspace-stickies')`. This expands collection/detail URLs under the included workspace prefix.

### `apps/api/plane/space/urls/intake.py` — 4 declarations

```text
/api/public/anchor/<str:anchor>/intakes/<uuid:intake_id>/intake-issues/ -> IntakeIssuePublicViewSet.as_view({'get': 'list', 'post': 'create'})
/api/public/anchor/<str:anchor>/intakes/<uuid:intake_id>/inbox-issues/ -> IntakeIssuePublicViewSet.as_view({'get': 'list', 'post': 'create'})
/api/public/anchor/<str:anchor>/intakes/<uuid:intake_id>/intake-issues/<uuid:pk>/ -> IntakeIssuePublicViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'})
/api/public/workspaces/<str:slug>/project-boards/ -> WorkspaceProjectDeployBoardEndpoint.as_view()
```

### `apps/api/plane/space/urls/issue.py` — 8 declarations

```text
/api/public/anchor/<str:anchor>/issues/<uuid:issue_id>/ -> IssueRetrievePublicEndpoint.as_view()
/api/public/anchor/<str:anchor>/issues/<uuid:issue_id>/comments/ -> IssueCommentPublicViewSet.as_view({'get': 'list', 'post': 'create'})
/api/public/anchor/<str:anchor>/issues/<uuid:issue_id>/comments/<uuid:pk>/ -> IssueCommentPublicViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'})
/api/public/anchor/<str:anchor>/issues/<uuid:issue_id>/reactions/ -> IssueReactionPublicViewSet.as_view({'get': 'list', 'post': 'create'})
/api/public/anchor/<str:anchor>/issues/<uuid:issue_id>/reactions/<str:reaction_code>/ -> IssueReactionPublicViewSet.as_view({'delete': 'destroy'})
/api/public/anchor/<str:anchor>/comments/<uuid:comment_id>/reactions/ -> CommentReactionPublicViewSet.as_view({'get': 'list', 'post': 'create'})
/api/public/anchor/<str:anchor>/comments/<uuid:comment_id>/reactions/<str:reaction_code>/ -> CommentReactionPublicViewSet.as_view({'delete': 'destroy'})
/api/public/anchor/<str:anchor>/issues/<uuid:issue_id>/votes/ -> IssueVotePublicViewSet.as_view({'get': 'list', 'post': 'create', 'delete': 'destroy'})
```

### `apps/api/plane/space/urls/project.py` — 9 declarations

```text
/api/public/anchor/<str:anchor>/meta/ -> ProjectMetaDataEndpoint.as_view()
/api/public/anchor/<str:anchor>/settings/ -> ProjectDeployBoardPublicSettingsEndpoint.as_view()
/api/public/anchor/<str:anchor>/issues/ -> ProjectIssuesPublicEndpoint.as_view()
/api/public/workspaces/<str:slug>/projects/<uuid:project_id>/anchor/ -> WorkspaceProjectAnchorEndpoint.as_view()
/api/public/anchor/<str:anchor>/cycles/ -> ProjectCyclesEndpoint.as_view()
/api/public/anchor/<str:anchor>/modules/ -> ProjectModulesEndpoint.as_view()
/api/public/anchor/<str:anchor>/states/ -> ProjectStatesEndpoint.as_view()
/api/public/anchor/<str:anchor>/labels/ -> ProjectLabelsEndpoint.as_view()
/api/public/anchor/<str:anchor>/members/ -> ProjectMembersEndpoint.as_view()
```

### `apps/api/plane/space/urls/asset.py` — 4 declarations

```text
/api/public/assets/v2/anchor/<str:anchor>/ -> EntityAssetEndpoint.as_view()
/api/public/assets/v2/anchor/<str:anchor>/<uuid:pk>/ -> EntityAssetEndpoint.as_view()
/api/public/assets/v2/anchor/<str:anchor>/restore/<uuid:pk>/ -> AssetRestoreEndpoint.as_view()
/api/public/assets/v2/anchor/<str:anchor>/<uuid:entity_id>/bulk/ -> EntityBulkAssetEndpoint.as_view()
```

### `apps/api/plane/authentication/urls.py` — 37 declarations

```text
/auth/sign-in/ -> SignInAuthEndpoint.as_view()
/auth/sign-up/ -> SignUpAuthEndpoint.as_view()
/auth/spaces/sign-in/ -> SignInAuthSpaceEndpoint.as_view()
/auth/spaces/sign-up/ -> SignUpAuthSpaceEndpoint.as_view()
/auth/sign-out/ -> SignOutAuthEndpoint.as_view()
/auth/spaces/sign-out/ -> SignOutAuthSpaceEndpoint.as_view()
/auth/get-csrf-token/ -> CSRFTokenEndpoint.as_view()
/auth/magic-generate/ -> MagicGenerateEndpoint.as_view()
/auth/magic-sign-in/ -> MagicSignInEndpoint.as_view()
/auth/magic-sign-up/ -> MagicSignUpEndpoint.as_view()
/auth/spaces/magic-generate/ -> MagicGenerateSpaceEndpoint.as_view()
/auth/spaces/magic-sign-in/ -> MagicSignInSpaceEndpoint.as_view()
/auth/spaces/magic-sign-up/ -> MagicSignUpSpaceEndpoint.as_view()
/auth/google/ -> GoogleOauthInitiateEndpoint.as_view()
/auth/google/callback/ -> GoogleCallbackEndpoint.as_view()
/auth/spaces/google/ -> GoogleOauthInitiateSpaceEndpoint.as_view()
/auth/spaces/google/callback/ -> GoogleCallbackSpaceEndpoint.as_view()
/auth/github/ -> GitHubOauthInitiateEndpoint.as_view()
/auth/github/callback/ -> GitHubCallbackEndpoint.as_view()
/auth/spaces/github/ -> GitHubOauthInitiateSpaceEndpoint.as_view()
/auth/spaces/github/callback/ -> GitHubCallbackSpaceEndpoint.as_view()
/auth/gitlab/ -> GitLabOauthInitiateEndpoint.as_view()
/auth/gitlab/callback/ -> GitLabCallbackEndpoint.as_view()
/auth/spaces/gitlab/ -> GitLabOauthInitiateSpaceEndpoint.as_view()
/auth/spaces/gitlab/callback/ -> GitLabCallbackSpaceEndpoint.as_view()
/auth/email-check/ -> EmailCheckEndpoint.as_view()
/auth/spaces/email-check/ -> EmailCheckSpaceEndpoint.as_view()
/auth/forgot-password/ -> ForgotPasswordEndpoint.as_view()
/auth/reset-password/<uidb64>/<token>/ -> ResetPasswordEndpoint.as_view()
/auth/spaces/forgot-password/ -> ForgotPasswordSpaceEndpoint.as_view()
/auth/spaces/reset-password/<uidb64>/<token>/ -> ResetPasswordSpaceEndpoint.as_view()
/auth/change-password/ -> ChangePasswordEndpoint.as_view()
/auth/set-password/ -> SetUserPasswordEndpoint.as_view()
/auth/gitea/ -> GiteaOauthInitiateEndpoint.as_view()
/auth/gitea/callback/ -> GiteaCallbackEndpoint.as_view()
/auth/spaces/gitea/ -> GiteaOauthInitiateSpaceEndpoint.as_view()
/auth/spaces/gitea/callback/ -> GiteaCallbackSpaceEndpoint.as_view()
```

### `apps/api/plane/license/urls.py` — 15 declarations

```text
/api/instances/ -> InstanceEndpoint.as_view()
/api/instances/admins/ -> InstanceAdminEndpoint.as_view()
/api/instances/admins/me/ -> InstanceAdminUserMeEndpoint.as_view()
/api/instances/admins/session/ -> InstanceAdminUserSessionEndpoint.as_view()
/api/instances/admins/sign-out/ -> InstanceAdminSignOutEndpoint.as_view()
/api/instances/admins/<uuid:pk>/ -> InstanceAdminEndpoint.as_view()
/api/instances/configurations/ -> InstanceConfigurationEndpoint.as_view()
/api/instances/configurations/test-llm/ -> LLMConnectionTestEndpoint.as_view()
/api/instances/configurations/disable-email-feature/ -> DisableEmailFeatureEndpoint.as_view()
/api/instances/admins/sign-in/ -> InstanceAdminSignInEndpoint.as_view()
/api/instances/admins/sign-up/ -> InstanceAdminSignUpEndpoint.as_view()
/api/instances/admins/sign-up-screen-visited/ -> SignUpScreenVisitedEndpoint.as_view()
/api/instances/email-credentials-check/ -> EmailCredentialCheckEndpoint.as_view()
/api/instances/workspace-slug-check/ -> InstanceWorkSpaceAvailabilityCheckEndpoint.as_view()
/api/instances/workspaces/ -> InstanceWorkSpaceEndpoint.as_view()
```

### `apps/api/plane/summon/urls.py` — 48 declarations

```text
/api/summon/workspaces/<str:slug>/assistant/conversations/ -> assistant_conversation_list
/api/summon/workspaces/<str:slug>/assistant/conversations/<uuid:pk>/ -> assistant_conversation_detail
/api/summon/workspaces/<str:slug>/assistant/conversations/<uuid:conversation_id>/messages/ -> AssistantMessageView.as_view()
/api/summon/workspaces/<str:slug>/assistant/conversations/<uuid:conversation_id>/attachments/ -> AssistantAttachmentView.as_view()
/api/summon/workspaces/<str:slug>/assistant/conversations/<uuid:conversation_id>/attachments/<uuid:attachment_id>/ -> AssistantAttachmentDetailView.as_view()
/api/summon/workspaces/<str:slug>/assistant/conversations/<uuid:conversation_id>/actions/<uuid:action_id>/confirm/ -> AssistantActionView.as_view()
/api/summon/workspaces/<str:slug>/assistant/conversations/<uuid:conversation_id>/actions/<uuid:action_id>/select/ -> AssistantActionView.as_view()
/api/summon/workspaces/<str:slug>/assistant/conversations/<uuid:conversation_id>/actions/<uuid:action_id>/retry/ -> AssistantActionView.as_view()
/api/summon/workspaces/<str:slug>/assistant/conversations/<uuid:conversation_id>/actions/<uuid:action_id>/cancel/ -> AssistantActionView.as_view()
/api/summon/workspaces/<str:slug>/home/summary/ -> HomeSummaryView.as_view()
/api/summon/workspaces/<str:slug>/settings/ai-status/ -> LLMStatusView.as_view()
/api/summon/workspaces/<str:slug>/settings/workspace/ -> SummonWorkspaceSettingsView.as_view()
/api/summon/workspaces/<str:slug>/settings/mcp-status/ -> MCPStatusView.as_view()
/api/summon/workspaces/<str:slug>/clients/ -> client_list
/api/summon/workspaces/<str:slug>/clients/<uuid:pk>/ -> client_detail
/api/summon/workspaces/<str:slug>/clients/<uuid:client_id>/contacts/ -> contact_list
/api/summon/workspaces/<str:slug>/clients/<uuid:client_id>/contacts/<uuid:pk>/ -> contact_detail
/api/summon/workspaces/<str:slug>/opportunities/ -> opportunity_list
/api/summon/workspaces/<str:slug>/opportunities/<uuid:pk>/ -> opportunity_detail
/api/summon/workspaces/<str:slug>/opportunities/<uuid:pk>/transitions/ -> OpportunityTransitionView.as_view()
/api/summon/workspaces/<str:slug>/opportunities/<uuid:pk>/delivery/ -> OpportunityDeliveryView.as_view()
/api/summon/workspaces/<str:slug>/projects/<uuid:project_id>/profile/ -> SummonProjectProfileView.as_view()
/api/summon/workspaces/<str:slug>/projects/<uuid:project_id>/overview/ -> ProjectOverviewView.as_view()
/api/summon/workspaces/<str:slug>/meetings/ -> meeting_list
/api/summon/workspaces/<str:slug>/meetings/<uuid:pk>/ -> meeting_detail
/api/summon/workspaces/<str:slug>/meetings/<uuid:meeting_id>/summary/ -> MeetingSummaryView.as_view()
/api/summon/workspaces/<str:slug>/meetings/<uuid:meeting_id>/work-items/ -> MeetingWorkItemView.as_view()
/api/summon/workspaces/<str:slug>/meetings/<uuid:meeting_id>/work-items/<uuid:pk>/ -> MeetingWorkItemDetailView.as_view()
/api/summon/workspaces/<str:slug>/page-contexts/ -> page_context_list
/api/summon/workspaces/<str:slug>/page-contexts/<uuid:pk>/ -> page_context_detail
/api/summon/workspaces/<str:slug>/resources/ -> resource_list
/api/summon/workspaces/<str:slug>/resources/<uuid:pk>/ -> resource_detail
/api/summon/workspaces/<str:slug>/automation/templates/ -> automation_template_list
/api/summon/workspaces/<str:slug>/automation/templates/<uuid:pk>/ -> automation_template_detail
/api/summon/workspaces/<str:slug>/automation/context/extract/ -> AutomationContextExtractView.as_view()
/api/summon/workspaces/<str:slug>/automation/jobs/ -> AutomationJobView.as_view()
/api/summon/workspaces/<str:slug>/automation/jobs/<uuid:job_id>/ -> AutomationJobDetailView.as_view()
/api/summon/workspaces/<str:slug>/automation/jobs/<uuid:job_id>/publish/ -> AutomationPublishView.as_view()
/api/summon/workspaces/<str:slug>/reports/summary/ -> ReportSummaryView.as_view()
/api/summon/workspaces/<str:slug>/reports/export.csv -> ReportExportView.as_view()
/api/summon/workspaces/<str:slug>/assistant/query/ -> AssistantQueryView.as_view()
/api/summon/workspaces/<str:slug>/credentials/ -> credential_list
/api/summon/workspaces/<str:slug>/credentials/<uuid:pk>/ -> credential_detail
/api/summon/workspaces/<str:slug>/credentials/<uuid:credential_id>/reveal/ -> CredentialRevealView.as_view()
/api/summon/workspaces/<str:slug>/credentials/<uuid:credential_id>/rotate/ -> CredentialRotateView.as_view()
/api/summon/workspaces/<str:slug>/credentials/<uuid:credential_id>/grants/ -> CredentialGrantView.as_view()
/api/summon/workspaces/<str:slug>/credentials/<uuid:credential_id>/grants/<uuid:pk>/ -> CredentialGrantDetailView.as_view()
/api/summon/workspaces/<str:slug>/credentials/<uuid:credential_id>/audit/ -> CredentialAuditView.as_view()
```

### `apps/api/plane/web/urls.py` — 2 declarations

```text
/robots.txt -> robots_txt
/ -> health_check
```

### Cross-project relation UI follow-up (source, not browser evidence)

After root reported d10 backend deployed to both hosts, task-structure now selects an authorized writer project, loads its task candidates in bounded pages, resets the captured target when changing project, and submits unchanged source/target revisions to the canonical relation direction owner. Related-task links use the returned authorized project identifier and clear stale project/task/comment subviews; removal respects per-row canRemove. Native web TS7/scoped Oxc pass and the module-owned route regression passes. Corrected backend structure regression now rejects foreign-workspace relations despite valid writer membership in both workspaces. Parent owns Chrome acceptance and commit.

### Bulk lifecycle UI activation and property trace

After parent confirmed `af588be807` on both hosts (including bulk backend), BulkLifecycle mounts in active, archived and trash lists. Selection is capped by canonical bulkAccess, captures row revisions, requires explicit operation confirmation, and retains captured selection after failed atomic batches. View changes remount selection. Scoped Oxc/format passed; initial web type gate encountered concurrent sign-in edits, not bulk errors, and awaits the shared final gate. Browser acceptance remains parent-owned.

Next property boundary: `core/services/issue/issue.service.ts:bulkOperations` posts `bulk-operation-issues`, but repository search found no corresponding registered Django route/controller in this checkout. The MobX consumer unions collection properties and replaces scalar properties; `TBulkIssueProperties` includes state, priority, labels, assignees, dates, modules, cycle and estimate. The separately registered IssueBulkUpdateDateEndpoint handles admin/member per-task date changes. Native bulk property implementation must reuse validateProperties/task revision/event owners and explicit cycle/module membership owners; a service declaration alone is not evidence that its external endpoint worked.
