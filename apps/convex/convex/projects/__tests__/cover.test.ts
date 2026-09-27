import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import { api, internal } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
const bytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6sQAAAABJRU5ErkJggg==",
  "base64"
);
const file = {
  name: "cover.png",
  contentType: "image/png",
  size: bytes.length,
  sha256: createHash("sha256").update(bytes).digest("base64"),
};
async function pending(f: Awaited<ReturnType<typeof workspaceJourney>>, revision: number) {
  const { assetId } = await f.owner.mutation(api.projects.cover.prepare, {
    projectId: f.projectId,
    expectedRevision: revision,
    ...file,
  });
  const storageId = await f.t.run((ctx) => ctx.storage.store(new Blob([bytes], { type: file.contentType })));
  return { assetId, storageId };
}
test("independent cover revision publishes one image, replaces and recovers while repeat finalize is idempotent", async () => {
  const f = await workspaceJourney();
  const first = await pending(f, 0);
  await f.owner.action(api.assets.upload.finalize, first);
  await f.owner.action(api.assets.upload.finalize, first);
  expect(await f.owner.query(api.projects.cover.get, { projectId: f.projectId })).toMatchObject({
    revision: 1,
    cover: { id: first.assetId },
  });
  const second = await pending(f, 1);
  await f.owner.action(api.assets.upload.finalize, second);
  expect((await f.owner.fetch(`/assets/${first.assetId}`)).status).toBe(403);
  await f.owner.mutation(api.projects.cover.restore, {
    projectId: f.projectId,
    assetId: first.assetId,
    expectedRevision: 2,
  });
  expect((await f.owner.fetch(`/assets/${first.assetId}`)).status).toBe(200);
  await expect(f.owner.mutation(api.assets.index.remove, { assetId: first.assetId })).rejects.toThrow("appearance");
  await f.owner.mutation(api.projects.cover.remove, {
    projectId: f.projectId,
    assetId: first.assetId,
    expectedRevision: 3,
  });
  expect(await f.owner.query(api.projects.cover.get, { projectId: f.projectId })).toMatchObject({
    revision: 4,
    cover: null,
  });
});
test("stale asynchronous upload cannot replace a newer cover; unrelated metadata changes do not invalidate cover intent", async () => {
  const f = await workspaceJourney();
  const slow = await pending(f, 0),
    fast = await pending(f, 0);
  await f.owner.mutation(api.projects.settings.save, {
    projectId: f.projectId,
    name: "Renamed",
    description: "Metadata only",
    expectedRevision: 0,
  });
  await f.owner.action(api.assets.upload.finalize, fast);
  await expect(f.owner.action(api.assets.upload.finalize, slow)).rejects.toThrow("changed");
  expect(await f.owner.query(api.projects.cover.get, { projectId: f.projectId })).toMatchObject({
    cover: { id: fast.assetId },
  });
});
test("archive or administrator revocation between upload and commit blocks publication", async () => {
  const f = await workspaceJourney();
  const ticket = await pending(f, 0);
  await f.owner.mutation(internal.assets.index.claim, ticket);
  await f.t.run((ctx) => ctx.db.patch(f.projectId, { archived: true }));
  await expect(f.owner.mutation(internal.assets.index.commit, { assetId: ticket.assetId })).rejects.toThrow(
    "not found"
  );
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.projectId, { archived: false });
    const member = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", f.projectId).eq("userId", f.userId))
      .unique();
    await ctx.db.patch(member!._id, { role: "member" });
  });
  await expect(f.owner.action(api.assets.upload.finalize, ticket)).rejects.toThrow("administrators");
});
test("current project readers can fetch cover bytes but cannot manage; cross-project and workspace-logo restoration fail", async () => {
  const f = await workspaceJourney();
  const ticket = await pending(f, 0);
  await f.owner.action(api.assets.upload.finalize, ticket);
  const readerId = await f.t.run(async (ctx) => {
    const id = await ctx.db.insert("users", { name: "Guest" });
    await ctx.db.insert("workspaceMembers", { workspaceId: f.workspaceId, userId: id, role: "guest", active: true });
    await ctx.db.insert("projectMembers", {
      workspaceId: f.workspaceId,
      projectId: f.projectId,
      userId: id,
      role: "guest",
      active: true,
    });
    return id;
  });
  const reader = await signedIn(f.t, readerId);
  expect((await reader.fetch(`/assets/${ticket.assetId}`)).status).toBe(200);
  expect((await reader.query(api.projects.cover.get, { projectId: f.projectId })).canManage).toBe(false);
  await expect(
    reader.mutation(api.projects.cover.prepare, { projectId: f.projectId, expectedRevision: 1, ...file })
  ).rejects.toThrow();
  await f.owner.mutation(api.projects.cover.remove, {
    projectId: f.projectId,
    assetId: ticket.assetId,
    expectedRevision: 1,
  });
  const projectId = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Other",
    identifier: "OTH",
  });
  await expect(
    f.owner.mutation(api.projects.cover.restore, { projectId, assetId: ticket.assetId, expectedRevision: 0 })
  ).rejects.toThrow("not found");
  await expect(
    f.owner.mutation(api.settings.logo.restore, {
      workspaceId: f.workspaceId,
      assetId: ticket.assetId,
      expectedRevision: 0,
    })
  ).rejects.toThrow("not found");
  await f.t.run((ctx) => ctx.db.patch(ticket.assetId, { expiresAt: 0 }));
  await expect(
    f.owner.mutation(api.projects.cover.restore, {
      projectId: f.projectId,
      assetId: ticket.assetId,
      expectedRevision: 2,
    })
  ).rejects.toThrow("no longer");
});
