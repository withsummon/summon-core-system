import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
const paginationOpts = { cursor: null, numItems: 20 };
async function trash(f: Awaited<ReturnType<typeof workspaceJourney>>) {
  const row = await f.owner.query(api.projects.lifecycle.get, { projectId: f.projectId });
  await f.owner.mutation(api.projects.lifecycle.setDeleted, {
    projectId: f.projectId,
    deleted: true,
    expectedRevision: row.revision,
  });
  return row;
}
test("project Trash is atomic, revision guarded and restores only ancestor visibility", async () => {
  const f = await workspaceJourney();
  const activeId = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Active" });
  const removedId = await f.owner.mutation(api.tasks.index.create, {
    projectId: f.projectId,
    title: "Independent Trash",
  });
  const removed = await f.owner.query(api.tasks.index.get, { taskId: removedId });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: removedId,
    expectedUpdatedAt: removed.updatedAt,
    operation: "delete",
  });
  const before = await trash(f);
  expect(await f.owner.query(api.projects.index.list, { workspaceId: f.workspaceId })).toEqual([]);
  await expect(f.owner.query(api.tasks.index.get, { taskId: activeId })).rejects.toThrow("Project not found");
  await expect(
    f.owner.mutation(api.projects.settings.setArchived, {
      projectId: f.projectId,
      archived: false,
      expectedRevision: before.revision + 1,
    })
  ).rejects.toThrow("Project not found");
  await expect(
    f.owner.mutation(api.projects.lifecycle.setDeleted, {
      projectId: f.projectId,
      deleted: false,
      expectedRevision: before.revision,
    })
  ).rejects.toThrow("changed");
  await expect(
    f.owner.mutation(api.projects.index.create, {
      workspaceId: f.workspaceId,
      name: "Replacement",
      identifier: before.identifier,
    })
  ).rejects.toThrow("already taken");
  const page = await f.owner.query(api.projects.lifecycle.list, { workspaceId: f.workspaceId, paginationOpts });
  expect(page.page).toHaveLength(1);
  await f.owner.mutation(api.projects.lifecycle.setDeleted, {
    projectId: f.projectId,
    deleted: false,
    expectedRevision: page.page[0].revision,
  });
  expect((await f.owner.query(api.tasks.index.get, { taskId: activeId })).title).toBe("Active");
  await expect(f.owner.query(api.tasks.index.get, { taskId: removedId })).rejects.toThrow("not found");
  expect((await f.t.run((ctx) => ctx.db.get(removedId)))?.deletedAt).not.toBeNull();
});
test("Trash authority is current workspace admin or project admin, never an ordinary reader", async () => {
  const f = await workspaceJourney();
  const id = await f.t.run((ctx) => ctx.db.insert("users", { name: "Member" }));
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId: id, role: "member" });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId: id, role: "member" });
  const member = await signedIn(f.t, id);
  await expect(
    member.mutation(api.projects.lifecycle.setDeleted, { projectId: f.projectId, deleted: true, expectedRevision: 0 })
  ).rejects.toThrow("administrators");
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId: id, role: "admin" });
  await member.mutation(api.projects.lifecycle.setDeleted, {
    projectId: f.projectId,
    deleted: true,
    expectedRevision: 0,
  });
  await f.t.run(async (ctx) => {
    const row = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", f.projectId).eq("userId", id))
      .unique();
    await ctx.db.patch(row!._id, { active: false });
  });
  expect(
    (await member.query(api.projects.lifecycle.list, { workspaceId: f.workspaceId, paginationOpts })).page
  ).toEqual([]);
  await expect(
    member.mutation(api.projects.lifecycle.setDeleted, { projectId: f.projectId, deleted: false, expectedRevision: 1 })
  ).rejects.toThrow("administrators");
  // Workspace administration grants lifecycle authority only, not ordinary project reads.
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId: id, role: "admin" });
  await member.mutation(api.projects.lifecycle.setDeleted, {
    projectId: f.projectId,
    deleted: false,
    expectedRevision: 1,
  });
  await expect(member.query(api.projects.settings.get, { projectId: f.projectId })).rejects.toThrow("access");
});
test("deleted project hides invitations and task files, blocks finalize, and redacts cross-project graph", async () => {
  const f = await workspaceJourney();
  const otherProject = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Other",
    identifier: "OTHER",
  });
  const source = await f.owner.mutation(api.tasks.index.create, { projectId: otherProject, title: "Visible source" });
  const target = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Secret target" });
  const a = await f.owner.query(api.tasks.index.get, { taskId: source });
  const b = await f.owner.query(api.tasks.index.get, { taskId: target });
  await f.owner.mutation(api.tasks.relationships.add, {
    taskId: source,
    relatedTaskId: target,
    kind: "relates_to",
    expectedUpdatedAt: a.updatedAt,
    expectedRelatedUpdatedAt: b.updatedAt,
  });
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const { createHash } = await import("node:crypto");
  const prepare = () =>
    f.owner.mutation(api.assets.taskAttachments.prepare, {
      taskId: target,
      name: "picture.png",
      contentType: "image/png",
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("base64"),
    });
  const ready = await prepare();
  const storageId = await f.t.run((ctx) => ctx.storage.store(new Blob([bytes], { type: "image/png" })));
  await f.owner.action(api.assets.upload.finalize, { assetId: ready.assetId, storageId });
  const pending = await prepare();
  const pendingStorage = await f.t.run((ctx) => ctx.storage.store(new Blob([bytes], { type: "image/png" })));
  const recipientId = await f.t.run((ctx) =>
    ctx.db.insert("users", { email: "recipient@example.test", emailVerificationTime: 1 })
  );
  const recipient = await signedIn(f.t, recipientId);
  const invite = await f.owner.action(api.invitations.tokens.create, {
    workspaceId: f.workspaceId,
    projectId: f.projectId,
    email: "recipient@example.test",
    role: "member",
  });
  await trash(f);
  expect((await recipient.query(api.invitations.index.incoming, { paginationOpts })).page).toEqual([]);
  await expect(recipient.action(api.invitations.tokens.respond, { ...invite, accepted: true })).rejects.toThrow();
  await expect(
    f.owner.query(api.assets.taskAttachments.get, { taskId: target, assetId: ready.assetId })
  ).rejects.toThrow();
  await expect(
    f.owner.action(api.assets.upload.finalize, { assetId: pending.assetId, storageId: pendingStorage })
  ).rejects.toThrow();
  const graph = await f.owner.query(api.tasks.relationships.list, { taskId: source });
  expect(JSON.stringify(graph)).not.toContain("Secret target");
  expect(graph).toEqual([]);
  expect((await f.t.run((ctx) => ctx.db.get(ready.assetId)))?.status).toBe("ready");
  await f.owner.mutation(api.projects.lifecycle.setDeleted, {
    projectId: f.projectId,
    deleted: false,
    expectedRevision: 1,
  });
  expect((await f.owner.query(api.assets.taskAttachments.get, { taskId: target, assetId: ready.assetId })).name).toBe(
    "picture.png"
  );
});
test("independent shared document access and live context survive while deleted project-only readers are denied", async () => {
  const f = await workspaceJourney();
  const other = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Shared",
    identifier: "SHARED",
  });
  const userId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Reader" }));
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role: "member" });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId, role: "member" });
  const reader = await signedIn(f.t, userId);
  const documentId = await f.owner.mutation(api.documents.index.create, {
    workspaceId: f.workspaceId,
    name: "Independent document",
    access: "public",
    isGlobal: false,
    projectIds: [f.projectId, other],
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
  await reader.query(api.documents.index.collaborationContext, { documentId });
  await trash(f);
  await expect(reader.query(api.documents.index.collaborationContext, { documentId })).rejects.toThrow("denied");
  expect((await f.owner.query(api.documents.index.collaborationContext, { documentId })).canWrite).toBe(true);
  await f.owner.mutation(api.projects.index.grantMember, { projectId: other, userId, role: "member" });
  expect((await reader.query(api.documents.index.collaborationContext, { documentId })).canWrite).toBe(true);
});
test("archived project stays archived after recovery and sparse Trash pages retain continuation", async () => {
  const f = await workspaceJourney();
  await f.owner.mutation(api.projects.settings.setArchived, {
    projectId: f.projectId,
    archived: true,
    expectedRevision: 0,
  });
  await trash(f);
  expect(
    (await f.owner.query(api.projects.settings.archived, { workspaceId: f.workspaceId, paginationOpts })).page
  ).toEqual([]);
  const row = await f.owner.query(api.projects.lifecycle.get, { projectId: f.projectId });
  await f.owner.mutation(api.projects.lifecycle.setDeleted, {
    projectId: f.projectId,
    deleted: false,
    expectedRevision: row.revision,
  });
  expect(
    (await f.owner.query(api.projects.settings.archived, { workspaceId: f.workspaceId, paginationOpts })).page[0]._id
  ).toBe(f.projectId);
  await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Another",
    identifier: "ANOTHER",
  });
  const sparse = await f.owner.query(api.projects.lifecycle.list, {
    workspaceId: f.workspaceId,
    paginationOpts: { cursor: null, numItems: 1 },
  });
  expect(sparse.page).toEqual([]);
  expect(sparse.isDone).toBe(false);
  expect(sparse.continueCursor).not.toBe("");
});
