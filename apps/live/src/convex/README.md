# Convex collaborative document rooms

## Owner and protocol

The separate `convex-start.ts` process accepts `convex:<documentId>` rooms and the bearer token issued by the configured Convex authentication integration. Each connection uses its own user identity. Convex owns document access, revisions and persisted content; Hocuspocus owns the shared Y.Doc.

Load applies stored Yjs bytes. The first writable connection initializes content using revision-zero compare-and-swap. Competing connections load the winning seed. Save merges the newest stored snapshot, then sends bytes and the expected revision to `documents.historyActions.save`. That Node action derives HTML, JSON and title with the existing editor converter. Its internal mutation rechecks access, size and revision in the write transaction. Only `DOCUMENT_REVISION_CONFLICT` retries, with a fresh merge, up to three attempts.

Each connection subscribes to its authorized context and snapshot. Durable updates propagate between live processes without scheduling another save. Incoming messages recheck access before applying updates. Access revocation, token expiry or a lost authorization subscription closes the connection. Failed persistence closes and quarantines the room; the server evicts that document instance before another connection loads durable content.

The native editor compares its local bytes with the stored snapshot before permitting navigation. Transport synchronization alone does not establish persistence. Disconnected clients can download their local copy. IndexedDB replay is disabled for Convex rooms, and rejected content is not retried under another user's identity.

## Run locally

Build through the repository's dependency graph:

```sh
pnpm turbo run build --filter=live
CONVEX_URL=http://127.0.0.1:3220 CONVEX_LIVE_HOST=127.0.0.1 CONVEX_LIVE_PORT=3235 node apps/live/dist/convex-start.mjs
```

Build the web app with `VITE_CONVEX_LIVE_URL=ws://127.0.0.1:3235` and the matching Convex API and auth-site URLs. The original `start.ts` still serves inherited Django-backed rooms until their migration gates pass.

## Remaining integration and limits

Transient awareness is limited to one live process. Document access currently requires an HTTP query before each incoming message; its latency and load need equivalent benchmarks. Parent notifications, administration force-close endpoints and PDF side effects still need integration with this process. Workspace document size limits apply. Local source or build verification does not establish production deployment, full editor parity or capacity.
