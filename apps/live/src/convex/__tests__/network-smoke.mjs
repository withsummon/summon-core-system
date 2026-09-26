import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const require = createRequire(new URL("../../../package.json", import.meta.url));
const editorRequire = createRequire(new URL("../../../../../packages/editor/package.json", import.meta.url));
const { ConvexHttpClient } = require("convex/browser");
const { HocuspocusProvider } = editorRequire("@hocuspocus/provider");
const Y = require("yjs");
const WebSocket = require("ws");
const { api } = await import("../../../../convex/convex/_generated/api.js");
async function signUp() {
  const client = new ConvexHttpClient(process.env.CONVEX_URL ?? "http://127.0.0.1:3210");
  const result = await client.action(api.auth.signIn, {
    provider: "password",
    params: { flow: "signUp", email: `live-${randomUUID()}@example.test`, password: randomUUID() },
  });
  assert.ok(result.tokens?.token);
  client.setAuth(result.tokens.token);
  const identity = await client.query(api.identity.index.current, {});
  return { client, token: result.tokens.token, id: identity.id };
}
async function until(check, label, attempt = 0) {
  if (await check()) return;
  if (attempt >= 150) throw new Error("Timed out: " + label);
  await new Promise((r) => setTimeout(r, 50));
  await until(check, label, attempt + 1);
}
function paragraph(doc, text) {
  const p = new Y.XmlElement("paragraph"),
    t = new Y.XmlText();
  t.insert(0, text);
  p.insert(0, [t]);
  doc.getXmlFragment("default").push([p]);
}
const owner = await signUp(),
  writer = await signUp();
const workspaceId = await owner.client.mutation(api.workspaces.index.create, {
  name: "Collaboration smoke",
  slug: "collab-" + randomUUID(),
});
const projectId = await owner.client.mutation(api.projects.index.create, {
  workspaceId,
  name: "Editor",
  identifier: "EDIT",
});
await owner.client.mutation(api.workspaces.index.grantMember, { workspaceId, userId: writer.id, role: "member" });
await owner.client.mutation(api.projects.index.grantMember, { projectId, userId: writer.id, role: "member" });
const documentId = await owner.client.mutation(api.documents.index.create, {
  workspaceId,
  projectIds: [projectId],
  name: "Collaboration",
  access: "public",
  isGlobal: false,
  color: "",
  viewProps: {},
  logoProps: {},
  sortOrder: 1,
  category: "",
  tags: [],
  clientId: null,
  opportunityId: null,
  externalId: null,
  externalSource: null,
});
let firstSynced = false,
  secondSynced = false,
  secondClosed = false,
  readOnly = false;
const first = new HocuspocusProvider({
  url: process.env.CONVEX_LIVE_URL ?? "ws://127.0.0.1:1235",
  name: "convex:" + documentId,
  token: owner.token,
  WebSocketPolyfill: WebSocket,
  onSynced: () => {
    firstSynced = true;
  },
  onAuthenticationFailed: () => {
    throw new Error("Owner auth failed");
  },
});
const second = new HocuspocusProvider({
  url: process.env.CONVEX_LIVE_URL ?? "ws://127.0.0.1:1235",
  name: "convex:" + documentId,
  token: writer.token,
  WebSocketPolyfill: WebSocket,
  onSynced: () => {
    secondSynced = true;
  },
  onClose: () => {
    secondClosed = true;
  },
  onStateless: ({ payload }) => {
    const event = JSON.parse(payload);
    if (event.type === "permission") readOnly = event.readOnly;
  },
});
const providers = [first, second];
let firstClosed = false;
first.on("close", () => {
  firstClosed = true;
  first.configuration.websocketProvider.disconnect();
});
second.on("close", () => second.configuration.websocketProvider.disconnect());
try {
  await until(() => firstSynced && secondSynced, "both JWT-authenticated clients sync");
  assert.ok(first.document.getXmlFragment("title").toString().includes("Collaboration"));
  paragraph(first.document, "Owner concurrent edit");
  paragraph(second.document, "Writer concurrent edit");
  await until(
    () =>
      first.document.getXmlFragment("default").toString().includes("Writer concurrent edit") &&
      second.document.getXmlFragment("default").toString().includes("Owner concurrent edit"),
    "bidirectional sync"
  );
  await until(async () => {
    const s = await owner.client.query(api.documents.index.snapshot, { documentId });
    return s?.descriptionHtml.includes("Owner concurrent edit") && s.descriptionHtml.includes("Writer concurrent edit");
  }, "durable merged renderings");
  const titleText = first.document.getXmlFragment("title").get(0).get(0);
  titleText.delete(0, titleText.length);
  titleText.insert(0, "Edited collaborative title");
  await until(
    async () =>
      (await owner.client.query(api.documents.index.get, { documentId })).name === "Edited collaborative title",
    "editor title persists atomically with snapshot"
  );
  await owner.client.mutation(api.documents.index.setLifecycle, {
    documentId,
    isLocked: true,
    archived: false,
    deleted: false,
  });
  await until(() => readOnly, "lock subscription read-only");
  paragraph(second.document, "Rejected locked edit");
  await new Promise((r) => setTimeout(r, 500));
  const locked = await owner.client.query(api.documents.index.snapshot, { documentId });
  assert.ok(!locked.descriptionHtml.includes("Rejected locked edit"));
  await owner.client.mutation(api.documents.index.setLifecycle, {
    documentId,
    isLocked: false,
    archived: false,
    deleted: false,
  });
  await owner.client.mutation(api.projects.index.revokeMember, { projectId, userId: writer.id });
  await until(() => secondClosed, "revocation closes idle subscriber");
  await owner.client.mutation(api.projects.index.grantMember, { projectId, userId: writer.id, role: "member" });
  let doomedSynced = false;
  const doomed = new HocuspocusProvider({
    url: process.env.CONVEX_LIVE_URL ?? "ws://127.0.0.1:1235",
    name: "convex:" + documentId,
    token: writer.token,
    WebSocketPolyfill: WebSocket,
    onSynced: () => {
      doomedSynced = true;
    },
  });
  providers.push(doomed);
  doomed.on("close", () => doomed.configuration.websocketProvider.disconnect());
  await until(() => doomedSynced, "writer reconnects");
  paragraph(doomed.document, "Rejected before debounce");
  await until(
    () => first.document.getXmlFragment("default").toString().includes("Rejected before debounce"),
    "server accepted pending edit"
  );
  await owner.client.mutation(api.projects.index.revokeMember, { projectId, userId: writer.id });
  await until(() => firstClosed, "failed persistence closes the old room");
  let freshSynced = false;
  const fresh = new HocuspocusProvider({
    url: process.env.CONVEX_LIVE_URL ?? "ws://127.0.0.1:1235",
    name: "convex:" + documentId,
    token: owner.token,
    WebSocketPolyfill: WebSocket,
    onSynced: () => {
      freshSynced = true;
    },
  });
  providers.push(fresh);
  await until(() => freshSynced, "fresh authorized document generation");
  assert.ok(!fresh.document.getXmlFragment("default").toString().includes("Rejected before debounce"));
  paragraph(fresh.document, "Fresh authorized edit");
  await until(async () => {
    const saved = await owner.client.query(api.documents.index.snapshot, { documentId });
    assert.ok(!saved.descriptionHtml.includes("Rejected before debounce"));
    return saved.descriptionHtml.includes("Fresh authorized edit");
  }, "fresh generation cannot persist rejected old-room bytes");
  console.log(
    JSON.stringify({
      passed: true,
      jwtIdentity: "two separately signed-up users",
      bidirectionalYjs: true,
      durableMergedHtml: true,
      lockedWriteRejected: true,
      revokedConnectionClosed: true,
      titleSeedPreserved: true,
      titleMetadataSynchronized: true,
      rejectedRoomEvicted: true,
      freshReconnectExcludesRejectedBytes: true,
      documentId,
    })
  );
} finally {
  providers.forEach((provider) => {
    provider.configuration.websocketProvider.destroy();
    provider.destroy();
    provider.document.destroy();
  });
}
