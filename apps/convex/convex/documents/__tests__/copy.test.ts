import { createHash } from "node:crypto";
import { expect, test, vi, afterEach } from "vitest";
import {
  getBinaryDataFromDocumentEditorHTMLString,
  getAllDocumentFormatsFromDocumentEditorBinaryData,
  documentEditorAssetSources,
} from "@plane/editor/lib";
import { api, internal } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
afterEach(() => vi.useRealTimers());
async function fixture() {
  const f = await workspaceJourney();
  const documentId = await f.owner.mutation(api.documents.index.create, {
    workspaceId: f.workspaceId,
    name: "Source",
    access: "public",
    isGlobal: false,
    projectIds: [f.projectId],
    color: "blue",
    viewProps: { font: "serif" },
    logoProps: { emoji: "book" },
    sortOrder: 5,
    category: "notes",
    tags: ["kept"],
    clientId: null,
    opportunityId: null,
    externalId: "external",
    externalSource: "import",
  });
  const bytes = "independent file bytes";
  const { assetId } = await f.owner.mutation(api.assets.index.prepare, {
    workspaceId: f.workspaceId,
    projectId: null,
    documentId,
    name: "content.txt",
    contentType: "text/plain",
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("base64"),
  });
  const storageId = await f.t.run((ctx) => ctx.storage.store(new Blob([bytes], { type: "text/plain" })));
  await f.owner.action(api.assets.upload.finalize, { assetId, storageId });
  const binary = getBinaryDataFromDocumentEditorHTMLString(
    `<p>Keep <strong>format</strong></p><image-component src="${assetId}" status="uploaded"></image-component>`,
    "Source"
  );
  const formats = getAllDocumentFormatsFromDocumentEditorBinaryData(binary, true);
  await f.owner.mutation(api.documents.index.saveSnapshot, {
    documentId,
    expectedRevision: 0,
    descriptionBinary: new Uint8Array(binary).buffer,
    descriptionHtml: formats.contentHTML,
    descriptionJson: formats.contentJSON,
  });
  const document = await f.owner.query(api.documents.index.get, { documentId });
  const args = {
    documentId,
    expectedRevision: document.revision,
    expectedUpdatedAt: document.updatedAt,
    requestId: "copy-request",
  };
  return { ...f, documentId, assetId, storageId, bytes, args, document };
}
test("copy atomically publishes fresh content and independent bytes, retains scalar/project/parent metadata but not labels, and retries idempotently", async () => {
  const f = await fixture();
  const parent = await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...fields } = f.document;
    const id = await ctx.db.insert("documents", { ...fields, name: "Parent", revision: 0 });
    await ctx.db.insert("documentParents", { documentId: f.documentId, parentId: id });
    const label = await ctx.db.insert("taskLabels", {
      workspaceId: f.workspaceId,
      projectId: f.projectId,
      name: "Original label",
      description: "",
      color: "red",
      sortOrder: 1,
      parentId: null,
      revision: 0,
      retiring: false,
    });
    await ctx.db.insert("documentLabels", { documentId: f.documentId, labelId: label });
    return id;
  });
  const result = await f.owner.action(api.documents.copyActions.run, f.args);
  expect(await f.owner.action(api.documents.copyActions.run, f.args)).toBe(result);
  const copy = await f.owner.query(api.documents.index.get, { documentId: result });
  const copiedSnapshot = await f.owner.query(api.documents.index.snapshot, { documentId: result });
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("documentReferenceJobs")
        .withIndex("by_snapshot", (q) => q.eq("snapshotId", copiedSnapshot!._id))
        .unique()
    )
  ).toMatchObject({ documentId: result, revision: 1, status: "pending" });
  expect(copy).toMatchObject({
    name: "Source (Copy)",
    projectIds: [f.projectId],
    color: "blue",
    tags: ["kept"],
    viewProps: { font: "serif" },
    ownedBy: f.userId,
    revision: 1,
  });
  expect((await f.owner.query(api.documents.hierarchy.parent, { documentId: result })).parent?.id).toBe(parent);
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("documentLabels")
        .withIndex("by_document", (q) => q.eq("documentId", result))
        .collect()
    )
  ).toHaveLength(0);
  const snapshot = await f.owner.query(api.documents.index.snapshot, { documentId: result });
  if (!snapshot) throw new Error("No copy snapshot");
  const sources = documentEditorAssetSources(new Uint8Array(snapshot.descriptionBinary));
  expect(sources).toHaveLength(1);
  expect(sources[0]).not.toBe(f.assetId);
  const copied = await f.owner.query(api.assets.index.resolveDocumentAsset, {
    documentId: result,
    assetId: sources[0],
  });
  if (!copied) throw new Error("No copied file");
  const row = await f.t.run((ctx) => ctx.db.get(copied.id));
  expect(row?.storageId).not.toBe(f.storageId);
  const response = await f.owner.fetch(copied.downloadPath);
  expect(await response.text()).toBe(f.bytes);
  await f.owner.mutation(api.assets.index.remove, { assetId: f.assetId });
  expect((await f.owner.fetch(copied.downloadPath)).status).toBe(200);
  expect(
    getAllDocumentFormatsFromDocumentEditorBinaryData(new Uint8Array(snapshot.descriptionBinary), true).titleHTML
  ).toBe("Source (Copy)");
  await expect(f.owner.action(api.documents.copyActions.run, { ...f.args, expectedRevision: 0 })).rejects.toThrow(
    "different content"
  );
});
test("staged files cannot be finalized or downloaded, durable progress resumes and expiry cannot delete published assets", async () => {
  const f = await fixture();
  const jobId = await f.owner.mutation(internal.documents.copy.begin, { ...f.args, assetIds: [f.assetId] });
  const job = await f.t.run((ctx) => ctx.db.get(jobId));
  if (!job) throw new Error("No job");
  const target = job.files[0].targetId;
  await expect(f.owner.action(api.assets.upload.finalize, { assetId: target, storageId: f.storageId })).rejects.toThrow(
    "not published"
  );
  expect((await f.owner.fetch(`/assets/${target}`)).status).not.toBe(200);
  const independent = await f.t.run((ctx) => ctx.storage.store(new Blob([f.bytes], { type: "text/plain" })));
  await f.owner.mutation(internal.documents.copy.record, { jobId, index: 0, storageId: independent });
  expect((await f.t.run((ctx) => ctx.db.get(jobId)))?.cursor).toBe(1);
  const copy = await f.owner.action(api.documents.copyActions.run, f.args);
  expect((await f.t.run((ctx) => ctx.db.get(target)))?.storageId).toBe(independent);
  vi.useFakeTimers();
  vi.advanceTimersByTime(20 * 60 * 1000);
  await f.t.mutation(internal.documents.copy.expire, { jobId });
  expect((await f.owner.fetch(`/assets/${target}`)).status).toBe(200);
  expect(await f.owner.query(api.documents.index.get, { documentId: copy })).toBeTruthy();
});
test("expired staged copies clean claimed bytes and never publish a partial document", async () => {
  const f = await fixture();
  const jobId = await f.owner.mutation(internal.documents.copy.begin, { ...f.args, assetIds: [f.assetId] });
  const independent = await f.t.run((ctx) => ctx.storage.store(new Blob([f.bytes], { type: "text/plain" })));
  await f.owner.mutation(internal.documents.copy.record, { jobId, index: 0, storageId: independent });
  vi.useFakeTimers();
  vi.advanceTimersByTime(20 * 60 * 1000);
  await f.t.mutation(internal.documents.copy.expire, { jobId });
  expect(await f.t.run((ctx) => ctx.storage.get(independent))).toBeNull();
  expect(await f.t.run((ctx) => ctx.db.query("documents").collect())).toHaveLength(1);
  await expect(f.owner.action(api.documents.copyActions.run, f.args)).rejects.toThrow("expired");
});
test("source changes or asset removal reject publication and current workspace/project ACL denies guests and revoked actors", async () => {
  const f = await fixture();
  const jobId = await f.owner.mutation(internal.documents.copy.begin, { ...f.args, assetIds: [f.assetId] });
  await f.owner.mutation(api.assets.index.remove, { assetId: f.assetId });
  await expect(f.owner.action(api.documents.copyActions.run, f.args)).rejects.toThrow("Asset not found");
  expect((await f.t.run((ctx) => ctx.db.get(jobId)))?.status).toBe("pending");
  const guestId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Guest" }));
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: guestId,
    role: "guest",
  });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId: guestId, role: "guest" });
  const guest = await signedIn(f.t, guestId);
  expect((await guest.query(api.documents.copy.availability, { documentId: f.documentId })).canCopy).toBe(false);
  await expect(guest.action(api.documents.copyActions.run, { ...f.args, requestId: "guest" })).rejects.toThrow();
  await f.t.run(async (ctx) => {
    const member = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", f.projectId).eq("userId", f.userId))
      .unique();
    if (member) await ctx.db.patch(member._id, { active: false });
  });
  await expect(f.owner.action(api.documents.copyActions.run, f.args)).rejects.toThrow();
});

test("captured content and metadata changes reject, and image budgets are explicit rather than truncated", async () => {
  const f = await fixture();
  await f.owner.mutation(internal.documents.copy.begin, { ...f.args, assetIds: [f.assetId] });
  await f.t.run((ctx) => ctx.db.patch(f.documentId, { updatedAt: f.document.updatedAt + 1, name: "Changed" }));
  await expect(f.owner.action(api.documents.copyActions.run, f.args)).rejects.toThrow("changed");
  await f.t.run((ctx) =>
    ctx.db.patch(f.documentId, { updatedAt: f.document.updatedAt, revision: f.document.revision + 1 })
  );
  await expect(f.owner.action(api.documents.copyActions.run, f.args)).rejects.toThrow("content changed");
  await f.t.run((ctx) => ctx.db.patch(f.documentId, { revision: f.document.revision }));
  await expect(
    f.owner.mutation(internal.documents.copy.begin, {
      ...f.args,
      requestId: "too-many",
      assetIds: Array.from({ length: 101 }, (_, i) => String(i)),
    })
  ).rejects.toThrow("100 distinct");
  await f.t.run((ctx) => ctx.db.patch(f.assetId, { size: 33 * 1024 * 1024 }));
  await expect(
    f.owner.mutation(internal.documents.copy.begin, { ...f.args, requestId: "too-large", assetIds: [f.assetId] })
  ).rejects.toThrow("32 MiB");
});
test("locked and archived source flags remain on copy; foreign image scope is never rebound", async () => {
  const f = await fixture();
  await f.owner.mutation(api.documents.index.setLifecycle, {
    documentId: f.documentId,
    expectedUpdatedAt: f.document.updatedAt,
    isLocked: true,
    archived: true,
    deleted: false,
  });
  const source = await f.owner.query(api.documents.index.get, { documentId: f.documentId });
  expect((await f.owner.query(api.documents.copy.availability, { documentId: f.documentId })).canCopy).toBe(true);
  const id = await f.owner.action(api.documents.copyActions.run, { ...f.args, expectedUpdatedAt: source.updatedAt });
  expect(await f.owner.query(api.documents.index.get, { documentId: id })).toMatchObject({
    isLocked: true,
    archived: true,
  });
  await f.t.run((ctx) => ctx.db.patch(f.assetId, { documentId: id }));
  await expect(
    f.owner.mutation(internal.documents.copy.begin, {
      ...f.args,
      requestId: "foreign-image",
      expectedUpdatedAt: source.updatedAt,
      assetIds: [f.assetId],
    })
  ).rejects.toThrow("another document");
});
test("parent changes during staging reject the final publish rather than silently changing hierarchy", async () => {
  const f = await fixture();
  const parentId = await f.t.run(async (ctx) => {
    const { _id, _creationTime, ...fields } = f.document;
    const createdParentId = await ctx.db.insert("documents", { ...fields, name: "Parent", revision: 0 });
    await ctx.db.insert("documentParents", { documentId: f.documentId, parentId: createdParentId });
    return createdParentId;
  });
  const jobId = await f.owner.mutation(internal.documents.copy.begin, { ...f.args, assetIds: [f.assetId] });
  await f.t.run((ctx) => ctx.db.patch(parentId, { updatedAt: f.document.updatedAt + 1 }));
  await expect(f.owner.action(api.documents.copyActions.run, f.args)).rejects.toThrow("Parent changed");
  expect((await f.t.run((ctx) => ctx.db.get(jobId)))?.resultId).toBeNull();
  expect(await f.t.run((ctx) => ctx.db.query("documents").collect())).toHaveLength(2);
});

test("a missing persisted snapshot rejects instead of silently copying an empty body", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const snapshot = await ctx.db
      .query("documentRevisions")
      .withIndex("by_document_revision", (q) => q.eq("documentId", f.documentId).eq("revision", f.document.revision))
      .unique();
    if (snapshot) await ctx.db.delete(snapshot._id);
  });
  await expect(f.owner.action(api.documents.copyActions.run, f.args)).rejects.toThrow("snapshot is unavailable");
  expect(await f.t.run((ctx) => ctx.db.query("documentCopies").collect())).toHaveLength(0);
  expect(await f.t.run((ctx) => ctx.db.query("documents").collect())).toHaveLength(1);
});
