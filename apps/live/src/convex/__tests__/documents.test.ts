import { beforeEach, afterEach, describe, expect, test, vi } from "vitest";
import { IncomingMessage } from "node:http";
import { Socket } from "node:net";
import { Document, Hocuspocus } from "@hocuspocus/server";
import { ConvexError } from "convex/values";
import { getFunctionName } from "convex/server";
import * as Y from "yjs";
import { convexDocuments } from "../documents";
import { ConvexHocuspocus } from "../server";

const remote = vi.hoisted(() => ({
  canWrite: true,
  revoked: false,
  revision: 0,
  bytes: new ArrayBuffer(0),
  html: "",
  mutations: 0,
  conflict: null as (() => void) | null,
  failure: null as Error | null,
}));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    token = "";
    setAuth(token: string) {
      this.token = token;
    }
    async query(reference: Parameters<typeof getFunctionName>[0]) {
      if (this.token !== "verified-jwt" || remote.revoked)
        throw new Error("Token or document access rejected by backend");
      if (getFunctionName(reference).endsWith("collaborationContext"))
        return {
          documentId: "document",
          userId: "verified-user",
          name: "Owner",
          documentName: "Initial title",
          canWrite: remote.canWrite,
        };
      return remote.revision === 0 ? null : { revision: remote.revision, descriptionBinary: remote.bytes };
    }
    async mutation(
      _reference: unknown,
      args: { expectedRevision: number; descriptionBinary: ArrayBuffer; descriptionHtml: string }
    ) {
      remote.mutations++;
      if (remote.failure) throw remote.failure;
      if (remote.revoked || !remote.canWrite) throw new Error("Write access revoked");
      const conflict = remote.conflict;
      remote.conflict = null;
      conflict?.();
      if (args.expectedRevision !== remote.revision)
        throw new ConvexError({ code: "DOCUMENT_REVISION_CONFLICT", message: "conflict" });
      remote.bytes = args.descriptionBinary;
      remote.html = args.descriptionHtml;
      return ++remote.revision;
    }
  },
  ConvexClient: vi.fn(),
}));

const documents: Document[] = [];
const servers: Hocuspocus[] = [];
function room() {
  const document = new Document("convex:document");
  const instance = new ConvexHocuspocus({ quiet: true });
  instance.documents.set(document.name, document);
  documents.push(document);
  servers.push(instance);
  return {
    document,
    documentName: document.name,
    instance,
    connection: { readOnly: false, requiresAuthentication: true, isAuthenticated: false },
    request: new IncomingMessage(new Socket()),
    requestHeaders: {},
    requestParameters: new URLSearchParams(),
    socketId: "test-socket",
    clientsCount: 1,
    context: {},
    token: "verified-jwt",
  };
}
function appendParagraph(doc: Y.Doc, text: string) {
  const paragraph = new Y.XmlElement("paragraph");
  const content = new Y.XmlText();
  content.insert(0, text);
  paragraph.insert(0, [content]);
  doc.getXmlFragment("default").push([paragraph]);
}
function decodedSnapshot() {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(remote.bytes));
  const text = doc.getXmlFragment("default").toString();
  doc.destroy();
  return text;
}
beforeEach(() => {
  Object.assign(remote, {
    canWrite: true,
    revoked: false,
    revision: 0,
    bytes: new ArrayBuffer(0),
    html: "",
    mutations: 0,
    conflict: null,
    failure: null,
  });
});
afterEach(async () => {
  documents.splice(0).forEach((document) => document.destroy());
  await Promise.all(
    servers.splice(0).map(async (server) => {
      await Promise.all([...server.documents.values()].map((document) => server.unloadDocument(document)));
      await server.destroy();
    })
  );
});

describe("Convex document Hocuspocus hooks with real Yjs", () => {
  test("authentication rejects legacy rooms and invalid tokens, and backend permissions set read-only", async () => {
    const extension = convexDocuments("http://localhost:3210");
    const payload = room();
    await expect(extension.onAuthenticate({ ...payload, documentName: "legacy-page" })).rejects.toThrow(
      "Convex document room"
    );
    await expect(extension.onAuthenticate({ ...payload, token: "forged-user-id" })).rejects.toThrow("backend");
    remote.canWrite = false;
    await extension.onAuthenticate(payload);
    expect(payload.connection.readOnly).toBe(true);
  });
  test("loads the original Yjs state and stores editor-derived HTML with both local and remote edits", async () => {
    const extension = convexDocuments("http://localhost:3210");
    const first = room();
    const context = await extension.onAuthenticate(first);
    appendParagraph(first.document, "Original");
    await extension.onStoreDocument({ ...first, context });
    const second = room();
    const secondContext = await extension.onAuthenticate(second);
    await extension.onLoadDocument({ ...second, context: secondContext });
    appendParagraph(first.document, "First writer");
    appendParagraph(second.document, "Second writer");
    await extension.onStoreDocument({ ...first, context });
    await extension.onStoreDocument({ ...second, context: secondContext });
    expect(decodedSnapshot()).toContain("First writer");
    expect(decodedSnapshot()).toContain("Second writer");
    expect(remote.html).toMatch(/<p[^>]*>Original<\/p>/);
    expect(remote.html).toMatch(/<p[^>]*>Second writer<\/p>/);
  });
  test("a CAS conflict reloads and merges the competing update before retrying", async () => {
    const extension = convexDocuments("http://localhost:3210");
    const payload = room();
    const context = await extension.onAuthenticate(payload);
    appendParagraph(payload.document, "Local");
    remote.mutations = 0;
    remote.conflict = () => {
      const concurrent = new Y.Doc();
      appendParagraph(concurrent, "Concurrent");
      remote.bytes = new Uint8Array(Y.encodeStateAsUpdate(concurrent)).buffer;
      remote.revision += 1;
      concurrent.destroy();
    };
    await extension.onStoreDocument({ ...payload, context });
    expect(remote.mutations).toBe(2);
    expect(decodedSnapshot()).toContain("Local");
    expect(decodedSnapshot()).toContain("Concurrent");
  });
  test.each(["revoked", "locked", "unavailable"])(
    "%s persistence retires the room without laundering unsaved edits on reconnect",
    async (failure) => {
      const extension = convexDocuments("http://localhost:3210");
      const payload = room();
      const context = await extension.onAuthenticate(payload);
      appendParagraph(payload.document, "Unsaved");
      remote.mutations = 0;
      remote.revoked = failure === "revoked";
      remote.canWrite = failure !== "locked";
      remote.failure = failure === "unavailable" ? new Error("Storage unavailable") : null;
      await extension.onStoreDocument({ ...payload, context });
      expect(remote.mutations).toBe(failure === "unavailable" ? 1 : 0);
      expect(payload.instance.documents.has(payload.documentName)).toBe(false);
      expect(payload.document.isDestroyed).toBe(true);
      remote.revoked = false;
      remote.canWrite = true;
      remote.failure = null;
      const fresh = new Document(payload.documentName);
      documents.push(fresh);
      payload.instance.documents.set(fresh.name, fresh);
      await extension.onLoadDocument({ ...payload, context, document: fresh });
      await payload.instance.unloadDocument(payload.document);
      expect(payload.instance.documents.get(fresh.name)).toBe(fresh);
      await extension.onStoreDocument({ ...payload, context });
      appendParagraph(fresh, "Authorized reconnect");
      await extension.onStoreDocument({ ...payload, context, document: fresh });
      expect(decodedSnapshot()).not.toContain("Unsaved");
      expect(decodedSnapshot()).toContain("Authorized reconnect");
    }
  );
  test("persistent revision conflicts stop after three merge-and-save attempts", async () => {
    const extension = convexDocuments("http://localhost:3210");
    const payload = room();
    const context = await extension.onAuthenticate(payload);
    appendParagraph(payload.document, "Local");
    remote.mutations = 0;
    remote.failure = new ConvexError({ code: "DOCUMENT_REVISION_CONFLICT", message: "conflict" });
    await extension.onStoreDocument({ ...payload, context });
    expect(remote.mutations).toBe(3);
    expect(remote.revision).toBe(1);
  });
});
