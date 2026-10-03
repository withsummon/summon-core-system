# Meeting recordings, transcripts and structured minutes

## Canonical ownership

`meetings/index` owns scheduling and participants; `meetings/tasks` links existing canonical tasks. No generated suggestion creates tasks automatically. `transcripts` owns raw source and revision; `summary/runs` owns request identity, generation and post-provider authorization. `mom` parses the strict native Zod result and renders the established MoM layout. The official `zodToConvexFields` derives the unchanged wire validator; no handwritten result mapper remains.

Source save and summary completion reuse the existing document create, metadata and snapshot owners in one mutation. The generated document is private, owned by the actor and linked to the meeting project. Writes require captured meeting/source/document revisions, current permissions, unlocked/unarchived state and current context authorization. Concurrent human edits win. Durable jobs retain the initiating account, then recheck membership and account restrictions; they retain no session or fabricated auth context.

The raw source survives minutes replacement in `meetingTranscripts` and canonical metadata. Existing `@plane/editor/lib` conversion loads captured Yjs bytes and replaces the title/body fragments with deletion markers, preserving already-open collaborative editors. The shared snapshot owner enforces its 512KiB binary and 100,000-character HTML/JSON budgets. Oversized conversion is rejected before publication. The latest query exposes the actor's prior authorized publication during failed/running regeneration and derives staleness from captured versions. A missing/inaccessible or unlinked canonical source is recoverable; unauthorized meeting access still fails.

## Recording transport and durable jobs

`assets/meetingRecordings` owns meeting-only prepare/policy/get/discard and validates current storage metadata. Audio accepts the inherited MIME catalog, a recognized signature and at most 250MiB. Generic asset writers reject meeting scope. Finalization streams only the signature prefix. Replacing/removing a recording expires its storage through the existing cleanup owner; unattached ready uploads expire after 24 hours.

The private `/assets/{id}` route requires a live session and current meeting ACL on every request. Convex HTTP actions have a [20MiB response limit](https://docs.convex.dev/file-storage/serve-files); recording responses require one exact range of at most 8MiB. Native storage range streaming verifies status/length/range and never returns its public capability URL. Missing, invalid or oversized ranges return 416. The shared browser asset owner assembles validated ranges into its managed object URL and revokes it on replacement/unmount. Browser playback currently materializes the whole recording; server/provider transfer is streaming.

`transcription/runs` deduplicates the full captured request, permits one active run, records its initiating account and two-hour deadline, and commits a six-minute watchdog before network work. Successful pending responses poll after five seconds. Attempts/CAS reject late delivery and changed recording/source/access. Cancellation marks the run terminal before scheduling sidecar cleanup; completion writes the source/document transactionally. Provider response parsing owns its 1MiB response and document conversion budgets. Completion authorization errors escape the parsing catch and are classified by the watchdog as changed recording/access.

The self-hosted sidecar persists SQLite and audio in `/data` (directory 700, database 600), fsyncs uploads and requeues interrupted running jobs. Its serialized supervised decoder process terminates on cancellation or hard timeout, allowing the next job to run. Unknown-ID cancellation leaves a durable tombstone to reject racing uploads. Retention cleans abandoned results/bytes and survives process restart. Models reload per job; that cost is unbenchmarked.

## Configuration and rollout

Set Convex `TRANSCRIPTION_ORIGIN` to the internal sidecar HTTP(S) origin and `TRANSCRIPTION_API_KEY` to a shared secret of at least 16 characters. Set the same sidecar key and persist `/data`. Defaults: 16 pending jobs (maximum 64), 300-second upload timeout, 1,800-second processing timeout (maximum), 24-hour retention (maximum seven days). `TRANSCRIPTION_MAX_BYTES`, `TRANSCRIPTION_MAX_PENDING`, `TRANSCRIPTION_UPLOAD_TIMEOUT_SECONDS`, `TRANSCRIPTION_PROCESSING_TIMEOUT_SECONDS` and `TRANSCRIPTION_RETENTION_SECONDS` configure these owners. Preserve at least 24 hours of cancellation tombstones independently of shorter result retention.

The summary provider reuses the Assistant's configured LLM adapter. Missing configuration and malformed output fail without changing source/publication. Summary generation remains a synchronous action with explicit cancellation/retry; interrupted generation recovery is not yet equivalent to the durable audio job. A vendor-specific structured-output extension is not assumed.

Build/run the native collaboration owner from `apps/live` against the same Convex API and set web `VITE_CONVEX_LIVE_URL` to its WebSocket endpoint. Auth-site HTTP and document WebSocket origins are distinct. The old synchronous `/transcribe` route remains for current Django consumers until their retirement gate closes; it uses the same serialized decoder owner. No other compatibility shape was added.

## Acceptance still open

Isolated API/Chrome and sidecar fake-decoder receipts are in the [current checklist](../../../../../docs/migrations/convex/current-parity-checklist.md#preserved-meeting-workspace-2026-10-02). They verify canonical storage/scheduler/browser interactions, not real ASR accuracy, 250MiB throughput, live LLM providers or production deployment. Microphone capture, speaker attribution, reminders/invitations, exports, full inherited lifecycle/role coverage, sidecar backup/restore and remote cutover remain OPEN. Do not retire Django/Postgres on these receipts.
