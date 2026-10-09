# Document user mentions

## Owner contract

The editor already persists mention-component tokens in Yjs using entity_name, entity_identifier, and a transaction id. Native editor/history previously rendered nothing; exports showed Unavailable mention. The inherited renderer depends on the Django member store and cannot run inside the native boundary.

The shared active workspace member directory now owns projection and search. Document mention queries authorize the current document before directory reads. Search returns bounded sparse pages with continuation; resolution accepts at most 100 raw IDs and returns unavailable for inactive, foreign, or malformed IDs. Mentioning a workspace member does not grant document access. Locked/archived readable documents retain resolution; private and deleted document restrictions remain canonical.

The native renderer registers visible tokens and deduplicates resolutions in batches of 100 rather than subscribing per chip. The inherited dropdown receives an optional paginated search callback and exposes Load more; existing callback consumers remain supported. Stale asynchronous search responses are discarded. History uses the same current-access projection. Export resolves all tokens in explicit sequential batches, replacing text only in the exported snapshot. Unknown entity types remain visibly unsupported. Stored Yjs tokens are never rewritten.

Task comment notifications use task-specific recipients and events, so this slice emits no document notifications. Document notification delivery remains a separate missing owner.

## Verification

Three backend behavior tests cover document authorization before directory access, inactive/foreign/malformed redaction, batch limits, sparse search continuation, and read-only lifecycle behavior without changing document revision. Backend and editor TypeScript 7 pass. Browser insertion, history, and export acceptance are recorded below. Member revocation is covered by backend behavior tests; no browser membership was revoked for this slice.

Backend checkpoint `5c2a967caf` passed all 545 tests across 86 files and the immutable archive TypeScript gate, then deployed locally to 3210. Remote activation remains held. Native web/editor TS7, editor distribution build, and all 47 frontend tests pass. New native files have zero Oxc findings; four inherited warnings remain in shared mention extension/dropdown code. Exact classic complexity peaks at 14 in export adaptation and 9 in asynchronous dropdown loading. Primary Chrome acceptance is recorded below.

## Chrome acceptance — 27 September 2026

On local dev 3010 with backend `5c2a967caf` and UI `ada9c0f5da`, inserted the current QA member into the independent copied document `md79zmrrzb3n3s80vtr2eynm2d8f7atw`. The picker listed the workspace members; selection rendered `@Northstar QA Owner updated`. Reload retained the token in revision 6, and opening that revision rendered the same label in the read-only historical body. The preexisting `test` paragraph, image, and acceptance paragraph were preserved. The original source document was not edited.

Downloaded No images Markdown contains `Mention QA @Northstar QA Owner updated` plus the preserved body. This verifies the exported name rather than only the prepared-download UI. At 390 × 844, the long chip wraps inside the editor; document scroll width equals viewport width (390), with no horizontal overflow. The temporary viewport override was cleared. This is local development acceptance, not a remote production build claim. No notification delivery or browser member-revocation claim is made.

## Notification contract trace

Inherited `apps/live/src/extensions/database.ts` converts a stored Yjs document and calls `CorePageService.updateDescriptionBinary` (`apps/live/src/services/page/core.service.ts`), which patches the registered page description route. `PagesDescriptionViewSet.partial_update` in `apps/api/plane/app/views/page/base.py` saves the description and queues `page_transaction` and `track_page_version`. `apps/api/plane/bgtasks/page_transaction_task.py` writes/deletes PageLog references keyed by page and token transaction; it does not create inbox notifications, send email, or subscribe recipients. The only registered PageLog read consumer found is `PageViewSet.retrieve`, which returns issue reference IDs. No page UI consumer or backlink endpoint was found in this checkout.

The inherited `notification_task.py` owns issue description/comment notifications, and native notification rows require a task and task event. Therefore document mention notification delivery is a product extension, not an inherited parity gap. This slice intentionally performs no delivery. Reference indexing remains a separate inherited data contract to migrate.
