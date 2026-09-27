# Convex collaborative document rooms

## Owner and protocol

The separate `convex-start.ts` process accepts only `convex:<documentId>` rooms and a raw Convex Auth JWT in the Hocuspocus provider token. It has no Django cookie fallback and never uses service/admin credentials. The existing `start.ts` process and legacy page rooms remain unchanged.

Convex verifies the JWT and derives the user and canonical document ID in `documents.collaborationContext`. Workspace, private-document and project visibility remain backend-owned. Hocuspocus owns the shared Y.Doc; the existing `@plane/editor/lib` converter derives HTML/JSON from its encoded state.

Load applies stored Yjs bytes directly. The first writable connection initializes an empty document from its metadata title using revision-zero compare-and-swap; competing processes load the winning seed instead of merging duplicate initial titles. Save fetches the newest snapshot, merges it with `Y.applyUpdate`, regenerates renderings, then performs an atomic revision-checked mutation including the editor-derived title. Only the structured `DOCUMENT_REVISION_CONFLICT` error triggers a retry, with a new load/merge each time, up to three attempts.

Already durable snapshots use the default non-client Yjs origin. Hocuspocus broadcasts those updates without scheduling a new save with missing client identity; pending authenticated client saves still merge the latest durable content.

Other failures report an unsaved-document event, close the room's clients, quarantine that document instance and evict its cached state. The dedicated Hocuspocus subclass removes a room by object identity before asynchronous unload hooks, preventing an old disconnect from evicting a newly loaded generation. A fresh connection loads only durable content. No service identity retries rejected edits. Clients must pause after save failure rather than automatically retransmit their entire old shared Y.Doc.

Each connection subscribes to its authorized context and current snapshot using that same user's JWT. This updates read-only permissions, propagates persisted changes from other live processes, and closes a revoked reader. Incoming messages recheck permissions before Hocuspocus applies them, and persistence checks again. Losing an established Convex subscription connection closes the document connection so an idle reader cannot continue receiving changes with an unmonitored ACL.

## Run locally

Build with `pnpm --filter live build`. Start with `CONVEX_URL=http://127.0.0.1:3210 CONVEX_LIVE_PORT=1235 node apps/live/dist/convex-start.mjs`. The standalone script accepts `CONVEX_URL` and `CONVEX_LIVE_URL` and creates isolated test users/documents:

```sh
node apps/live/src/convex/__tests__/network-smoke.mjs
```

Hook tests live in the same `__tests__` folder and use real Yjs plus the real editor converter, with the Convex network mocked. The network smoke uses real Password signup/JWT verification and actual Hocuspocus providers. It verifies bidirectional edits, persisted merged HTML, title initialization, locked-write rejection, revocation disconnect and rejection of unsaved bytes after a fresh authorized reconnect. It creates test data and emits only a document ID and outcome flags, never tokens.

## Remaining integration and limits

The native `/core` editor now selects this endpoint/room prefix, supplies refreshed JWTs, handles permission/save-failed events and offers an explicit download of unsaved recovery content. IndexedDB replay is disabled for Convex rooms; rejected shared state cannot be silently replayed under another identity. Legacy page routes continue using the original live service. This server cannot refresh a user's JWT; expiration fails closed and the client must reconnect with a fresh token. Page parent notifications, admin force-close routes and PDF/file side effects are not wired into this process.

Multi-process content convergence uses durable Convex snapshot subscriptions; transient awareness/presence is limited to a single live process until a dedicated shared awareness transport is implemented. Authorization currently makes an HTTP query before every incoming message, which adds network latency and backend load; neither is benchmarked here. This slice is not a production deployment, capacity benchmark or rendered editor QA result. The backend snapshot size limits still apply, and raw public snapshot writes are not independently validated as Yjs by Convex.
