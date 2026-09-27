# Derived document reference index

## Inherited owner and scope

The registered page description save queues `page_transaction` (`apps/api/plane/bgtasks/page_transaction_task.py`). That task extracts mention/image transaction tokens, maintains PageLog rows unique by page and transaction, and deletes removed references. The only registered read consumer found is `PageViewSet.retrieve` returning `issue_ids`; no page inbox notification producer, web consumer of those IDs, or backlink endpoint was found. This slice migrates the reference data contract. It does not introduce backlink UI or document notification delivery.

## Snapshot and derived generation ownership

`saveDocumentSnapshot` atomically schedules a durable generation for its immutable saved revision. It remains the owner used by live saves, history restore, and document copy. No new content admission cap is imposed: the existing 100,000-character JSON and 512 KiB binary limits bound extraction input.

Each internal indexing mutation processes 50 token rows. Extraction traverses canonical editor JSON, preserves transaction/entity IDs, records mentions and custom images, and deterministically deduplicates transaction IDs. Empty transaction IDs are omitted, matching inherited PageLog behavior. Stored document content is never rewritten.

Publication happens only after all tokens are indexed and the snapshot's document/revision provenance and current document revision still match. A superseded job stops before indexing another batch and schedules its partial generation for cleanup. Old published rows are cleaned in batches of 50 after the pointer switches. Cleanup checks the publication pointer and cannot delete its current generation. Document soft deletion hides reads without erasing the index; restore can reuse it.

The public `documents.references.issues` reader requires current document access, reports `updating` and the current revision without stale rows while the new generation is pending, and paginates only that published generation. Every task reference is normalized and checked for same workspace, current task lifecycle, and current task/project/workspace access. Unavailable targets have no title or target ID projection. Consumers must reset pagination when the returned revision changes.

Existing documents require the internal paginated backfill, including soft-deleted documents with stored revisions. It schedules only missing latest-snapshot jobs and reports newly scheduled jobs, so a second completed scan returns zero. It never scans all documents inside a user read.

## Verification

Behavior tests cover 600 references without an artificial 500-token rejection; 50-row progress and publication only after completion; stale job supersession, partial cleanup, and protection of the published generation; removing all tokens; target/source lifecycle authorization; canonical Yjs conversion and token deduplication; provenance rejection and idempotent backfill. Existing real copy/history action tests assert their newly created snapshots schedule indexing through the shared owner.

Deployment/backfill and live runtime acceptance are pending. No frontend display or notification side effect is introduced.
