import { ConvexClient, ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Extension, Connection, Document } from "@hocuspocus/server";
import { getBinaryDataFromDocumentEditorHTMLString } from "@plane/editor/lib";
import * as Y from "yjs";

const ROOM_PREFIX = "convex:";
const MAX_SAVE_ATTEMPTS = 3;
type Access = FunctionReturnType<typeof api.documents.index.collaborationContext>;

class DocumentSession {
  readonly http: ConvexHttpClient;
  private live: ConvexClient | null = null;
  constructor(
    readonly url: string,
    private readonly token: string,
    readonly access: Access
  ) {
    this.http = new ConvexHttpClient(url);
    this.http.setAuth(token);
  }
  async authorize() {
    return this.http.query(api.documents.index.collaborationContext, { documentId: this.access.documentId });
  }
  watch(connection: Connection) {
    const live = new ConvexClient(this.url);
    this.live = live;
    const deny = () => connection.close();
    live.subscribeToConnectionState((state) => {
      if (state.hasEverConnected && !state.isWebSocketConnected) deny();
    });
    live.setAuth(
      async () => this.token,
      (authenticated) => {
        if (!authenticated) deny();
      }
    );
    live.onUpdate(
      api.documents.index.collaborationContext,
      { documentId: this.access.documentId },
      (access) => {
        connection.readOnly = !access.canWrite;
      },
      deny
    );
    live.onUpdate(
      api.documents.index.snapshot,
      { documentId: this.access.documentId },
      (snapshot) => {
        try {
          // A durable server update has no client origin. Hocuspocus must not
          // schedule a new authenticated save for bytes already committed.
          if (snapshot) Y.applyUpdate(connection.document, new Uint8Array(snapshot.descriptionBinary));
        } catch {
          connection.close({ code: 4003, reason: "Stored document cannot be decoded." });
        }
      },
      deny
    );
  }
  async close() {
    const live = this.live;
    this.live = null;
    await live?.close();
  }
}

function session(context: unknown): DocumentSession {
  if (
    !context ||
    typeof context !== "object" ||
    !("session" in context) ||
    !(context.session instanceof DocumentSession)
  ) {
    throw new Error("Convex document authentication required.");
  }
  return context.session;
}

function isRevisionConflict(error: unknown) {
  return (
    error instanceof ConvexError &&
    error.data !== null &&
    typeof error.data === "object" &&
    error.data.code === "DOCUMENT_REVISION_CONFLICT"
  );
}

async function persist(document: Document, auth: DocumentSession, attempt = 0): Promise<void> {
  const access = await auth.authorize();
  if (!access.canWrite) throw new Error("Document is read-only.");
  const latest = await auth.http.query(api.documents.index.snapshot, { documentId: access.documentId });
  // Never discard updates committed by another live process. Applying the snapshot
  // is a Yjs merge, not replacement; concurrent local edits remain in this document.
  if (latest) Y.applyUpdate(document, new Uint8Array(latest.descriptionBinary));
  const bytes = Y.encodeStateAsUpdate(document);
  if (latest) {
    const stored = new Uint8Array(latest.descriptionBinary);
    const snapshot = Y.createSnapshot(
      Y.decodeUpdate(stored).ds,
      Y.decodeStateVector(Y.encodeStateVectorFromUpdate(stored))
    );
    if (Y.snapshotContainsUpdate(snapshot, bytes)) return;
  }
  try {
    await auth.http.action(api.documents.historyActions.save, {
      documentId: access.documentId,
      expectedRevision: latest?.revision ?? 0,
      descriptionBinary: new Uint8Array(bytes).buffer,
    });
    return;
  } catch (error) {
    if (!isRevisionConflict(error) || attempt === MAX_SAVE_ATTEMPTS - 1) throw error;
    await persist(document, auth, attempt + 1);
  }
}

// Dedicated extension: no Django cookies, legacy page services, or service/admin keys.
export function convexDocuments(url: string) {
  const rejectedDocuments = new WeakSet<Document>();
  return {
    async onAuthenticate({ token, documentName, connection }) {
      if (!documentName.startsWith(ROOM_PREFIX) || !token)
        throw new Error("A Convex document room and token are required.");
      const http = new ConvexHttpClient(url);
      http.setAuth(token);
      // Convex verifies the JWT and resolves both user and document ID server-side.
      const access = await http.query(api.documents.index.collaborationContext, {
        documentId: documentName.slice(ROOM_PREFIX.length),
      });
      connection.readOnly = !access.canWrite;
      const auth = new DocumentSession(url, token, access);
      if (access.canWrite) {
        const existing = await auth.http.query(api.documents.index.snapshot, { documentId: access.documentId });
        if (!existing) {
          const bytes = getBinaryDataFromDocumentEditorHTMLString("<p></p>", access.documentName);
          try {
            await auth.http.action(api.documents.historyActions.save, {
              documentId: access.documentId,
              expectedRevision: 0,
              descriptionBinary: new Uint8Array(bytes).buffer,
            });
          } catch (error) {
            // Another process won initialization. Loading its bytes avoids duplicate
            // independently seeded title/content structs in the shared Y.Doc.
            if (!isRevisionConflict(error)) throw error;
          }
        }
      }
      return { session: auth };
    },
    async onLoadDocument({ context, document }) {
      const auth = session(context);
      const snapshot = await auth.http.query(api.documents.index.snapshot, { documentId: auth.access.documentId });
      if (snapshot) Y.applyUpdate(document, new Uint8Array(snapshot.descriptionBinary));
    },
    async connected({ context, connectionInstance }) {
      if (rejectedDocuments.has(connectionInstance.document)) {
        connectionInstance.close({ code: 4003, reason: "Reload document after failed save." });
        return;
      }
      session(context).watch(connectionInstance);
    },
    async beforeHandleMessage({ context, connection, document }) {
      if (rejectedDocuments.has(document)) throw new Error("Reload document after failed save.");
      const access = await session(context)
        .authorize()
        .catch((error) => {
          connection.close();
          throw error;
        });
      connection.readOnly = !access.canWrite;
    },
    async onStoreDocument({ context, document, instance }) {
      if (rejectedDocuments.has(document)) return;
      try {
        await persist(document, session(context));
      } catch (error) {
        rejectedDocuments.add(document);
        // Prevent unsaved rejected edits from later being persisted under another
        // connection's identity. Clients keep their local Y.Doc for recovery.
        document.getConnections().forEach((connection) => {
          connection.close({ code: 4003, reason: "Document persistence failed." });
        });
        await instance.unloadDocument(document);
        console.error("Convex document save failed; room evicted.", error);
      }
    },
    async onDisconnect({ context }) {
      await session(context).close();
    },
  } satisfies Extension;
}
