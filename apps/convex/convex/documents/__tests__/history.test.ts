import { expect, test } from "vitest";
import {
  getBinaryDataFromDocumentEditorHTMLString,
  getAllDocumentFormatsFromDocumentEditorBinaryData,
  replaceDocumentEditorHTML,
  applyUpdates,
} from "@plane/editor/lib";
import { api, internal } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
function formats(binary: Uint8Array) {
  const value = getAllDocumentFormatsFromDocumentEditorBinaryData(binary, true);
  return {
    descriptionBinary: new Uint8Array(binary).buffer,
    descriptionHtml: value.contentHTML,
    descriptionJson: value.contentJSON,
  };
}
async function fixture() {
  const f = await workspaceJourney();
  const documentId = await f.owner.mutation(api.documents.index.create, {
    workspaceId: f.workspaceId,
    name: "Current title",
    access: "public",
    isGlobal: true,
    projectIds: [],
    color: "",
    viewProps: {},
    logoProps: {},
    sortOrder: 0,
    category: "document",
    tags: [],
    clientId: null,
    opportunityId: null,
    externalId: null,
    externalSource: null,
  });
  const oldBinary = getBinaryDataFromDocumentEditorHTMLString("<p>Earlier <strong>content</strong></p>", "Old title");
  await f.owner.mutation(api.documents.index.saveSnapshot, {
    documentId,
    expectedRevision: 0,
    ...formats(oldBinary),
    descriptionHtml: "<p>Incorrect derived HTML</p>",
  });
  const first = await f.owner.query(api.documents.index.snapshot, { documentId });
  if (!first) throw new Error("Missing first snapshot");
  const currentBinary = replaceDocumentEditorHTML(
    oldBinary,
    "<p>New content that must be removed</p>",
    "Current title"
  );
  await f.owner.mutation(api.documents.index.saveSnapshot, {
    documentId,
    expectedRevision: 1,
    ...formats(currentBinary),
  });
  const current = await f.owner.query(api.documents.index.snapshot, { documentId });
  if (!current) throw new Error("Missing current snapshot");
  const document = await f.owner.query(api.documents.index.get, { documentId });
  return { ...f, documentId, first, current, document, currentBinary };
}
test("restore decodes historical binary into current CRDT, preserves current title, merges deletions and retains undo history", async () => {
  const f = await fixture();
  const preview = await f.owner.action(api.documents.historyActions.preview, {
    documentId: f.documentId,
    versionId: f.first._id,
  });
  expect(preview.html).toContain("Earlier");
  expect(preview.html).not.toContain("Incorrect");
  await f.owner.action(api.documents.historyActions.restore, {
    documentId: f.documentId,
    versionId: f.first._id,
    expectedRevision: f.document.revision,
    expectedUpdatedAt: f.document.updatedAt,
  });
  const restored = await f.owner.query(api.documents.index.snapshot, { documentId: f.documentId });
  if (!restored) throw new Error("No restore");
  const merged = getAllDocumentFormatsFromDocumentEditorBinaryData(
    applyUpdates(f.currentBinary, new Uint8Array(restored.descriptionBinary)),
    true
  );
  expect(merged.contentHTML).toContain("Earlier");
  expect(merged.contentHTML).not.toContain("New content");
  expect(merged.titleHTML).toBe("Current title");
  const reverse = getAllDocumentFormatsFromDocumentEditorBinaryData(
    applyUpdates(new Uint8Array(restored.descriptionBinary), f.currentBinary),
    true
  );
  expect(reverse.contentHTML).toBe(merged.contentHTML);
  expect(await f.t.run((ctx) => ctx.db.get(f.first._id))).toEqual(f.first);
  const document = await f.owner.query(api.documents.index.get, { documentId: f.documentId });
  await f.owner.action(api.documents.historyActions.restore, {
    documentId: f.documentId,
    versionId: f.current._id,
    expectedRevision: document.revision,
    expectedUpdatedAt: document.updatedAt,
  });
  const undo = await f.owner.query(api.documents.index.snapshot, { documentId: f.documentId });
  expect(undo?.descriptionHtml).toContain("New content");
  expect(undo?.revision).toBe(4);
  const page = await f.owner.query(api.documents.history.list, {
    documentId: f.documentId,
    paginationOpts: { cursor: null, numItems: 2 },
  });
  expect(page.page.map((row) => row.revision)).toEqual([4, 3]);
  expect(page.isDone).toBe(false);
  expect(page.page[0]).not.toHaveProperty("descriptionBinary");
});
test("restore rejects stale content or metadata and rechecks locks at the commit boundary", async () => {
  const f = await fixture();
  const args = {
    documentId: f.documentId,
    versionId: f.first._id,
    expectedRevision: f.document.revision,
    expectedUpdatedAt: f.document.updatedAt,
  };
  await f.owner.mutation(api.documents.index.saveSnapshot, {
    documentId: f.documentId,
    expectedRevision: 2,
    ...formats(f.currentBinary),
  });
  await expect(f.owner.action(api.documents.historyActions.restore, args)).rejects.toThrow("changed");
  const latest = await f.owner.query(api.documents.index.get, { documentId: f.documentId });
  await expect(
    f.owner.mutation(internal.documents.history.commit, {
      ...args,
      expectedUpdatedAt: latest.updatedAt,
      ...formats(f.currentBinary),
    })
  ).rejects.toThrow("revision conflict");
  await f.owner.mutation(api.documents.index.setLifecycle, {
    documentId: f.documentId,
    expectedUpdatedAt: latest.updatedAt,
    isLocked: true,
    archived: false,
    deleted: false,
  });
  await expect(
    f.owner.action(api.documents.historyActions.restore, {
      ...args,
      expectedRevision: latest.revision,
      expectedUpdatedAt: latest.updatedAt,
    })
  ).rejects.toThrow("locked");
  await expect(
    f.owner.mutation(internal.documents.history.commit, { ...args, ...formats(f.currentBinary) })
  ).rejects.toThrow("changed");
  const locked = await f.owner.query(api.documents.index.get, { documentId: f.documentId });
  await expect(
    f.owner.mutation(internal.documents.history.commit, {
      ...args,
      expectedRevision: locked.revision,
      expectedUpdatedAt: locked.updatedAt,
      ...formats(f.currentBinary),
    })
  ).rejects.toThrow("locked");
  expect((await f.owner.query(api.documents.index.get, { documentId: f.documentId })).revision).toBe(3);
});
test("private history and foreign document versions remain inaccessible and permission revocation prevents commit", async () => {
  const f = await fixture();
  const userId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Reader" }));
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role: "member" });
  const member = await signedIn(f.t, userId);
  expect(
    (await member.action(api.documents.historyActions.preview, { documentId: f.documentId, versionId: f.first._id }))
      .revision
  ).toBe(1);
  await f.t.run((ctx) => ctx.db.patch(f.documentId, { access: "private" }));
  await expect(
    member.query(api.documents.history.list, {
      documentId: f.documentId,
      paginationOpts: { cursor: null, numItems: 10 },
    })
  ).rejects.toThrow("denied");
  await expect(
    member.mutation(internal.documents.history.commit, {
      documentId: f.documentId,
      versionId: f.first._id,
      expectedRevision: f.document.revision,
      expectedUpdatedAt: f.document.updatedAt,
      ...formats(f.currentBinary),
    })
  ).rejects.toThrow("denied");
  const foreignVersion = await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...fields } = f.document;
    const otherId = await ctx.db.insert("documents", { ...fields, name: "Other" });
    return ctx.db.insert("documentRevisions", {
      documentId: otherId,
      revision: 1,
      createdBy: f.userId,
      ...formats(f.currentBinary),
    });
  });
  await expect(
    f.owner.action(api.documents.historyActions.preview, { documentId: f.documentId, versionId: foreignVersion })
  ).rejects.toThrow("not found");
});
