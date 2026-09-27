# Document user mentions

## Owner contract

The editor already persists mention-component tokens in Yjs using entity_name, entity_identifier, and a transaction id. Native editor/history previously rendered nothing; exports showed Unavailable mention. The inherited renderer depends on the Django member store and cannot run inside the native boundary.

The shared active workspace member directory now owns projection and search. Document mention queries authorize the current document before directory reads. Search returns bounded sparse pages with continuation; resolution accepts at most 100 raw IDs and returns unavailable for inactive, foreign, or malformed IDs. Mentioning a workspace member does not grant document access. Locked/archived readable documents retain resolution; private and deleted document restrictions remain canonical.

The native renderer registers visible tokens and deduplicates resolutions in batches of 100 rather than subscribing per chip. The inherited dropdown receives an optional paginated search callback and exposes Load more; existing callback consumers remain supported. Stale asynchronous search responses are discarded. History uses the same current-access projection. Export resolves all tokens in explicit sequential batches, replacing text only in the exported snapshot. Unknown entity types remain visibly unsupported. Stored Yjs tokens are never rewritten.

Task comment notifications use task-specific recipients and events, so this slice emits no document notifications. Document notification delivery remains a separate missing owner.

## Verification

Three backend behavior tests cover document authorization before directory access, inactive/foreign/malformed redaction, batch limits, sparse search continuation, and read-only lifecycle behavior without changing document revision. Backend and editor TypeScript 7 pass. Browser insertion, history, export, and member revocation acceptance will be recorded after activation.
