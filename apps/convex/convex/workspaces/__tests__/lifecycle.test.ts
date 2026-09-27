import { expect, test } from "vitest";
import { api, internal } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
import { taskCanRead } from "../../tasks/access";
import { discussionCanRead } from "../../tasks/discussion_access";
const paginationOpts = { cursor: null, numItems: 20 };
async function trash(f: Awaited<ReturnType<typeof workspaceJourney>>) {
  const row = await f.owner.query(api.workspaces.lifecycle.get, { workspaceId: f.workspaceId });
  await f.owner.mutation(api.workspaces.lifecycle.setDeleted, {
    workspaceId: f.workspaceId,
    deleted: true,
    expectedRevision: row.revision,
  });
  return row.revision + 1;
}
test("Trash preserves child lifecycle and slug, hides destination and rejects stale recovery", async () => {
  const f = await workspaceJourney();
  await f.owner.mutation(api.projects.lifecycle.setDeleted, {
    projectId: f.projectId,
    deleted: true,
    expectedRevision: 0,
  });
  const revision = await trash(f);
  expect(await f.owner.query(api.workspaces.index.list, {})).toEqual([]);
  expect((await f.owner.query(api.identity.preferences.destination, {})).workspace).toBeNull();
  await expect(f.owner.query(api.projects.index.list, { workspaceId: f.workspaceId })).rejects.toThrow(
    "Workspace not found"
  );
  await expect(
    f.owner.mutation(api.workspaces.index.create, { name: "Replacement", slug: "workspace" })
  ).rejects.toThrow("already taken");
  await expect(
    f.owner.mutation(api.workspaces.lifecycle.setDeleted, {
      workspaceId: f.workspaceId,
      deleted: false,
      expectedRevision: revision - 1,
    })
  ).rejects.toThrow("changed");
  expect((await f.owner.query(api.workspaces.lifecycle.list, { paginationOpts })).page).toHaveLength(1);
  await f.owner.mutation(api.workspaces.lifecycle.setDeleted, {
    workspaceId: f.workspaceId,
    deleted: false,
    expectedRevision: revision,
  });
  expect((await f.t.run((ctx) => ctx.db.get(f.projectId)))?.deletedAt).not.toBeNull();
});
test("project administrator cannot delete workspace; revoked admin cannot recover", async () => {
  const f = await workspaceJourney();
  const userId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Other" }));
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role: "member" });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId, role: "admin" });
  const actor = await signedIn(f.t, userId);
  await expect(
    actor.mutation(api.workspaces.lifecycle.setDeleted, {
      workspaceId: f.workspaceId,
      deleted: true,
      expectedRevision: 0,
    })
  ).rejects.toThrow("workspace administrators");
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role: "admin" });
  await trash(f);
  await f.t.run(async (ctx) => {
    const m = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", f.workspaceId).eq("userId", userId))
      .unique();
    await ctx.db.patch(m!._id, { active: false });
  });
  await expect(actor.query(api.workspaces.lifecycle.get, { workspaceId: f.workspaceId })).rejects.toThrow(
    "workspace administrators"
  );
  expect((await actor.query(api.workspaces.lifecycle.list, { paginationOpts })).page).toEqual([]);
});
test("notification ACL and invitations cannot disclose or grant deleted workspace access", async () => {
  const f = await workspaceJourney();
  const taskId = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Secret" });
  const userId = await f.t.run((ctx) =>
    ctx.db.insert("users", { email: "recipient@example.test", emailVerificationTime: 1 })
  );
  const actor = await signedIn(f.t, userId);
  const invite = await f.owner.action(api.invitations.tokens.create, {
    workspaceId: f.workspaceId,
    projectId: null,
    email: "recipient@example.test",
    role: "member",
  });
  const revision = await trash(f);
  await f.t.run(async (ctx) => {
    const task = (await ctx.db.get(taskId))!;
    expect(await taskCanRead(ctx, task, f.userId)).toBe(false);
    expect(await discussionCanRead(ctx, task, f.userId)).toBe(false);
  });
  await expect(
    f.owner.query(api.notifications.index.list, {
      workspaceId: f.workspaceId,
      view: "inbox",
      unreadOnly: false,
      now: Date.now(),
      paginationOpts,
    })
  ).rejects.toThrow("Workspace not found");
  expect((await actor.query(api.invitations.index.incoming, { paginationOpts })).page).toEqual([]);
  await expect(actor.action(api.invitations.tokens.respond, { ...invite, accepted: true })).rejects.toThrow(
    "authority"
  );
  expect((await f.t.run((ctx) => ctx.db.get(invite.invitationId)))?.status).toBe("pending");
  await f.owner.mutation(api.workspaces.lifecycle.setDeleted, {
    workspaceId: f.workspaceId,
    deleted: false,
    expectedRevision: revision,
  });
  expect((await f.owner.query(api.tasks.index.get, { taskId })).title).toBe("Secret");
});
test("bounded additive backfill preserves tombstones and repeats without changes", async () => {
  const f = await workspaceJourney();
  await trash(f);
  const legacy = await f.t.run((ctx) =>
    ctx.db.insert("workspaces", { name: "Legacy", slug: "legacy", metadataRevision: 7 })
  );
  expect(await f.t.mutation(internal.workspaces.lifecycle.backfill, { cursor: null })).toMatchObject({
    changed: 1,
    processed: 2,
    isDone: true,
  });
  expect((await f.t.mutation(internal.workspaces.lifecycle.backfill, { cursor: null })).changed).toBe(0);
  expect(await f.t.run((ctx) => ctx.db.get(legacy))).toMatchObject({ deletedAt: null, metadataRevision: 7 });
  expect((await f.t.run((ctx) => ctx.db.get(f.workspaceId)))?.deletedAt).not.toBeNull();
});
test("owner document live context and ready bytes are inaccessible until ancestor recovery", async () => {
  const f = await workspaceJourney();
  const documentId = await f.owner.mutation(api.documents.index.create, {
    workspaceId: f.workspaceId,
    name: "Owned",
    access: "public",
    isGlobal: true,
    projectIds: [],
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
  const taskId = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Files" });
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const { createHash } = await import("node:crypto");
  const prepare = () =>
    f.owner.mutation(api.assets.taskAttachments.prepare, {
      taskId,
      name: "image.png",
      contentType: "image/png",
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("base64"),
    });
  const ready = await prepare();
  const storageId = await f.t.run((ctx) => ctx.storage.store(new Blob([bytes], { type: "image/png" })));
  await f.owner.action(api.assets.upload.finalize, { assetId: ready.assetId, storageId });
  const pending = await prepare();
  const pendingStorage = await f.t.run((ctx) => ctx.storage.store(new Blob([bytes], { type: "image/png" })));
  const revision = await trash(f);
  await expect(f.owner.query(api.documents.index.collaborationContext, { documentId })).rejects.toThrow(
    "Workspace not found"
  );
  await expect(f.owner.query(api.assets.taskAttachments.get, { taskId, assetId: ready.assetId })).rejects.toThrow(
    "Workspace not found"
  );
  await expect(
    f.owner.action(api.assets.upload.finalize, { assetId: pending.assetId, storageId: pendingStorage })
  ).rejects.toThrow("Workspace not found");
  expect((await f.t.run((ctx) => ctx.db.get(ready.assetId)))?.status).toBe("ready");
  await f.t.run(async (ctx) => {
    expect(await ctx.storage.get(storageId)).not.toBeNull();
  });
  await f.owner.mutation(api.workspaces.lifecycle.setDeleted, {
    workspaceId: f.workspaceId,
    deleted: false,
    expectedRevision: revision,
  });
  expect((await f.owner.query(api.documents.index.collaborationContext, { documentId })).canWrite).toBe(true);
  expect((await f.owner.query(api.assets.taskAttachments.get, { taskId, assetId: ready.assetId })).name).toBe(
    "image.png"
  );
});
test("credential metadata nullable reader denies workspace tombstone", async () => {
  const f = await workspaceJourney();
  const { credentialMetadataAccess } = await import("../../mcp/access");
  const credentialId = await f.t.run((ctx) =>
    ctx.db.insert("mcpCredentials", {
      workspaceId: f.workspaceId,
      ownerId: f.userId,
      name: "Private",
      accountIdentifier: "owner",
      projectId: null,
      remoteWorkspaceSlug: "remote",
      remoteProjectId: null,
      status: "active",
      revision: 1,
    })
  );
  await trash(f);
  await f.t.run(async (ctx) => {
    expect(await credentialMetadataAccess(ctx, (await ctx.db.get(credentialId))!, f.userId)).toBeNull();
  });
  await expect(f.owner.query(api.mcp.credentials.list, { workspaceId: f.workspaceId, paginationOpts })).rejects.toThrow(
    "Workspace not found"
  );
});
test("sole administrator cannot deactivate and orphan a recoverable workspace", async () => {
  const f = await workspaceJourney();
  await f.t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Instance admin" });
    const instanceId = await ctx.db.insert("instanceAuthority", { key: "instance", initializedAt: Date.now() });
    await ctx.db.insert("instanceAdmins", { instanceId, userId, role: "admin", revision: 1 });
  });
  const sessionId = await f.t.run((ctx) =>
    ctx.db.insert("authSessions", { userId: f.userId, expirationTime: Date.now() + 600000 })
  );
  const actor = f.t.withIdentity({ subject: `${f.userId}|${sessionId}` });
  await trash(f);
  await expect(actor.mutation(internal.identity.deactivation.index.commit, { sessionId })).rejects.toThrow(
    "workspace administrator"
  );
  expect((await actor.query(api.workspaces.lifecycle.get, { workspaceId: f.workspaceId })).deletedAt).not.toBeNull();
});
test("Trash pagination retains empty-page continuation and never enumerates foreign workspaces", async () => {
  const f = await workspaceJourney();
  const second = await f.owner.mutation(api.workspaces.index.create, { name: "Second", slug: "second" });
  await f.owner.mutation(api.workspaces.lifecycle.setDeleted, {
    workspaceId: second,
    deleted: true,
    expectedRevision: 0,
  });
  const first = await f.owner.query(api.workspaces.lifecycle.list, { paginationOpts: { numItems: 1, cursor: null } });
  expect(first.page).toEqual([]);
  expect(first.isDone).toBe(false);
  const next = await f.owner.query(api.workspaces.lifecycle.list, {
    paginationOpts: { numItems: 1, cursor: first.continueCursor },
  });
  expect(next.page.map((row) => row.id)).toEqual([second]);
  const foreignUserId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Outside" }));
  const foreign = await signedIn(f.t, foreignUserId);
  expect((await foreign.query(api.workspaces.lifecycle.list, { paginationOpts })).page).toEqual([]);
  await expect(foreign.query(api.workspaces.lifecycle.get, { workspaceId: second })).rejects.toThrow(
    "workspace administrators"
  );
});
