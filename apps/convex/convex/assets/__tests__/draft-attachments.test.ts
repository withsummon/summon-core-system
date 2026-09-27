import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import { api, internal } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
const text = "Private draft file";
const file = {
  name: "draft.txt",
  contentType: "text/plain",
  size: Buffer.byteLength(text),
  sha256: createHash("sha256").update(text).digest("base64"),
};
async function fixture() {
  const f = await workspaceJourney();
  const draftId = await f.owner.mutation(api.tasks.drafts.index.create, { workspaceId: f.workspaceId });
  const d = await f.owner.query(api.tasks.drafts.index.resolve, { workspaceId: f.workspaceId, draftId });
  await f.owner.mutation(api.tasks.drafts.index.save, {
    draftId,
    expectedContentRevision: d.contentRevision,
    projectId: f.projectId,
    title: "Draft files",
    html: d.html,
    status: d.status,
    properties: d.properties,
    parent: null,
    cycle: null,
    modules: [],
  });
  const draft = await f.owner.query(api.tasks.drafts.index.resolve, { workspaceId: f.workspaceId, draftId });
  const ticket = await f.owner.mutation(api.assets.draftAttachments.prepare, { draftId, ...file });
  const storageId = await f.t.run((ctx) => ctx.storage.store(new Blob([text], { type: file.contentType })));
  return { ...f, draftId, draft, ticket: { assetId: ticket.assetId, storageId } };
}
test("draft files stay author-private and publish rebinds verified bytes preserving uploader", async () => {
  const f = await fixture();
  await f.owner.action(api.assets.upload.finalize, f.ticket);
  const latest = await f.owner.query(api.tasks.drafts.index.resolve, {
    workspaceId: f.workspaceId,
    draftId: f.draftId,
  });
  const other = await f.t.run(async (ctx) => {
    const id = await ctx.db.insert("users", {});
    await ctx.db.insert("workspaceMembers", { workspaceId: f.workspaceId, userId: id, role: "admin", active: true });
    return id;
  });
  await expect(
    f.t.withIdentity({ subject: other }).query(api.assets.index.get, { assetId: f.ticket.assetId })
  ).rejects.toThrow("not found");
  await expect(f.owner.mutation(api.assets.index.remove, { assetId: f.ticket.assetId })).rejects.toThrow("draft");
  const copyId = await f.owner.action(api.tasks.drafts.copy.run, {
    draftId: f.draftId,
    expectedUpdatedAt: latest.updatedAt,
  });
  const copied = await f.owner.query(api.assets.draftAttachments.list, {
    draftId: copyId,
    deleted: false,
    paginationOpts: { cursor: null, numItems: 20 },
  });
  expect(copied.page).toHaveLength(1);
  const copyAsset = await f.t.run((ctx) => ctx.db.get(copied.page[0].id));
  expect(copyAsset?.storageId).not.toBe(f.ticket.storageId);
  expect(await (await f.owner.fetch(copied.page[0].downloadPath)).text()).toBe(text);
  const published = await f.owner.mutation(api.tasks.drafts.index.publish, {
    draftId: f.draftId,
    expectedUpdatedAt: latest.updatedAt,
  });
  const asset = await f.owner.query(api.assets.taskAttachments.get, {
    taskId: published.taskId,
    assetId: f.ticket.assetId,
  });
  expect(asset).toMatchObject({ createdBy: f.draft.authorId, taskId: published.taskId, draftId: null, revision: 1 });
  expect(await (await f.owner.fetch(asset.downloadPath)).text()).toBe(text);
  await expect(
    f.owner.query(api.assets.draftAttachments.list, {
      draftId: f.draftId,
      deleted: false,
      paginationOpts: { cursor: null, numItems: 20 },
    })
  ).rejects.toThrow("unavailable");
  expect(await f.owner.action(api.assets.upload.finalize, f.ticket)).toBe(f.ticket.assetId);
});
test("pending publication rolls back created task artifacts; cancel makes publication recoverable", async () => {
  const f = await fixture();
  const before = await f.t.run((ctx) => ctx.db.get(f.projectId));
  await expect(
    f.owner.mutation(api.tasks.drafts.index.publish, { draftId: f.draftId, expectedUpdatedAt: f.draft.updatedAt })
  ).rejects.toThrow("pending");
  const state = await f.t.run(async (ctx) => ({
    tasks: await ctx.db.query("tasks").collect(),
    events: await ctx.db.query("taskEvents").collect(),
    descriptions: await ctx.db.query("taskDescriptions").collect(),
    subscriptions: await ctx.db.query("taskSubscriptions").collect(),
    project: await ctx.db.get(f.projectId),
    asset: await ctx.db.get(f.ticket.assetId),
  }));
  expect(state.tasks).toHaveLength(0);
  expect(state.events).toHaveLength(0);
  expect(state.descriptions).toHaveLength(0);
  expect(state.subscriptions).toHaveLength(0);
  expect(state.project?.nextSequence).toBe(before?.nextSequence);
  expect(state.asset?.draftId).toBe(f.draftId);
  await f.owner.mutation(api.assets.draftAttachments.cancelUpload, { draftId: f.draftId, assetId: f.ticket.assetId });
  await expect(f.owner.action(api.assets.upload.finalize, f.ticket)).rejects.toThrow("closed");
  await f.owner.mutation(api.tasks.drafts.index.publish, { draftId: f.draftId, expectedUpdatedAt: f.draft.updatedAt });
});
test("draft removal closes finalization, restoring draft and file retains independent CAS", async () => {
  const f = await fixture();
  await f.owner.action(api.assets.upload.finalize, f.ticket);
  await f.owner.mutation(api.assets.draftAttachments.change, {
    draftId: f.draftId,
    assetId: f.ticket.assetId,
    expectedRevision: 0,
    deleted: true,
  });
  await expect(
    f.owner.mutation(api.assets.draftAttachments.change, {
      draftId: f.draftId,
      assetId: f.ticket.assetId,
      expectedRevision: 0,
      deleted: false,
    })
  ).rejects.toThrow("changed");
  await f.owner.mutation(api.assets.draftAttachments.change, {
    draftId: f.draftId,
    assetId: f.ticket.assetId,
    expectedRevision: 1,
    deleted: false,
  });
  const current = await f.owner.query(api.tasks.drafts.index.resolve, {
    workspaceId: f.workspaceId,
    draftId: f.draftId,
  });
  await f.owner.mutation(api.tasks.drafts.index.lifecycle, {
    draftId: f.draftId,
    expectedUpdatedAt: current.updatedAt,
    deleted: true,
  });
  await expect(f.owner.action(api.assets.upload.finalize, f.ticket)).rejects.toThrow("unavailable");
  expect((await f.owner.fetch(`/assets/${f.ticket.assetId}`)).status).toBe(403);
});
test("attachment changes invalidate publication approval but do not invalidate an open content draft", async () => {
  const f = await fixture();
  const opened = f.draft;
  await f.owner.action(api.assets.upload.finalize, f.ticket);
  await expect(
    f.owner.mutation(api.tasks.drafts.index.publish, { draftId: f.draftId, expectedUpdatedAt: opened.updatedAt })
  ).rejects.toThrow("changed");
  await f.owner.mutation(api.tasks.drafts.index.save, {
    draftId: f.draftId,
    expectedContentRevision: opened.contentRevision,
    projectId: opened.projectId,
    title: "Unsaved text retained",
    html: "<p>New body</p>",
    status: opened.status,
    properties: opened.properties,
    parent: opened.parent,
    cycle: opened.cycle,
    modules: opened.modules,
  });
  const saved = await f.owner.query(api.tasks.drafts.index.resolve, { workspaceId: f.workspaceId, draftId: f.draftId });
  expect(saved.title).toBe("Unsaved text retained");
  expect(saved.contentRevision).toBe(opened.contentRevision + 1);
  expect(
    (
      await f.owner.query(api.assets.draftAttachments.list, {
        draftId: f.draftId,
        deleted: false,
        paginationOpts: { cursor: null, numItems: 20 },
      })
    ).page
  ).toHaveLength(1);
});

test("copy reauthorizes source after byte copying and rolls back its destination on conflict", async () => {
  const f = await fixture();
  await f.owner.action(api.assets.upload.finalize, f.ticket);
  const source = await f.owner.query(api.tasks.drafts.index.resolve, {
    workspaceId: f.workspaceId,
    draftId: f.draftId,
  });
  const storageId = await f.t.run((ctx) => ctx.storage.store(new Blob([text], { type: file.contentType })));
  await f.owner.mutation(api.assets.draftAttachments.change, {
    draftId: f.draftId,
    assetId: f.ticket.assetId,
    expectedRevision: 0,
    deleted: true,
  });
  await expect(
    f.owner.mutation(internal.tasks.drafts.copy.commit, {
      draftId: f.draftId,
      expectedUpdatedAt: source.updatedAt,
      files: [{ sourceId: f.ticket.assetId, revision: 0, storageId }],
    })
  ).rejects.toThrow("changed");
  expect(await f.t.run((ctx) => ctx.db.query("taskDrafts").collect())).toHaveLength(1);
});
test("closed upload history does not consume live capacity or block publication", async () => {
  const f = await fixture();
  await f.owner.mutation(api.assets.draftAttachments.cancelUpload, { draftId: f.draftId, assetId: f.ticket.assetId });
  await f.t.run(async (ctx) => {
    const original = await ctx.db.get(f.ticket.assetId);
    if (!original) throw new Error("Missing fixture");
    const { _id, _creationTime, ...data } = original;
    await Promise.all(Array.from({ length: 105 }, () => ctx.db.insert("assets", data)));
  });
  const next = await f.owner.mutation(api.assets.draftAttachments.prepare, { draftId: f.draftId, ...file });
  await f.owner.mutation(api.assets.draftAttachments.cancelUpload, { draftId: f.draftId, assetId: next.assetId });
  const published = await f.owner.mutation(api.tasks.drafts.index.publish, {
    draftId: f.draftId,
    expectedUpdatedAt: f.draft.updatedAt,
  });
  expect(published.taskId).toBeTruthy();
});
