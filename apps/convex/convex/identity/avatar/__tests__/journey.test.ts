import { createHash } from "node:crypto";
import { test, expect } from "vitest";
import { api, internal } from "../../../_generated/api";
import { workspaceJourney } from "../../../../test-support/fixtures";
import { signedIn } from "../../../../test-support/session";
const bytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6sQAAAABJRU5ErkJggg==",
  "base64"
);
const file = {
  name: "avatar.png",
  contentType: "image/png",
  size: bytes.length,
  sha256: createHash("sha256").update(bytes).digest("base64"),
};
async function upload(f: Awaited<ReturnType<typeof workspaceJourney>>, revision: number) {
  const { assetId } = await f.owner.mutation(api.identity.avatar.prepare, { ...file, expectedRevision: revision });
  const storageId = await f.t.run((ctx) => ctx.storage.store(new Blob([bytes], { type: file.contentType })));
  return { assetId, storageId };
}
test("personal avatar survives zero memberships, shares profile CAS, replaces and recovers independently", async () => {
  const f = await workspaceJourney();
  await f.t.run(async (ctx) => {
    const members = await ctx.db.query("workspaceMembers").collect();
    await Promise.all(members.map((member) => ctx.db.patch(member._id, { active: false })));
  });
  const first = await upload(f, 0);
  await f.owner.action(api.assets.upload.finalize, first);
  await f.owner.action(api.assets.upload.finalize, first);
  expect((await f.owner.query(api.identity.profile.get, {})).revision).toBe(1);
  expect((await f.owner.fetch(`/assets/${first.assetId}`)).status).toBe(200);
  const stale = await upload(f, 1),
    second = await upload(f, 1);
  await f.owner.action(api.assets.upload.finalize, second);
  await expect(f.owner.action(api.assets.upload.finalize, stale)).rejects.toThrow("changed");
  expect((await f.owner.fetch(`/assets/${first.assetId}`)).status).toBe(403);
  await f.owner.mutation(api.identity.avatar.restore, { assetId: first.assetId, expectedRevision: 2 });
  await f.owner.mutation(api.identity.avatar.remove, { assetId: first.assetId, expectedRevision: 3 });
  expect((await f.owner.query(api.identity.avatar.get, {})).avatar).toBeNull();
  await expect(
    // @ts-expect-error Deliberately malformed public input exercises runtime validation.
    f.owner.mutation(api.assets.index.prepare, { ...file, workspaceId: null, projectId: null, documentId: null })
  ).rejects.toThrow();
});
test("workspace-context byte reads reauthorize both memberships and never confer avatar writes", async () => {
  const f = await workspaceJourney();
  const ticket = await upload(f, 0);
  await f.owner.action(api.assets.upload.finalize, ticket);
  const readerId = await f.t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Reader" });
    await ctx.db.insert("workspaceMembers", { workspaceId: f.workspaceId, userId, role: "guest", active: true });
    return userId;
  });
  const reader = await signedIn(f.t, readerId);
  const avatar = await reader.query(api.identity.avatar.member, { workspaceId: f.workspaceId, userId: f.userId });
  expect((await reader.fetch(avatar!.downloadPath)).status).toBe(200);
  expect((await reader.fetch(`/assets/${ticket.assetId}`)).status).toBe(403);
  await expect(
    reader.mutation(api.identity.avatar.remove, { assetId: ticket.assetId, expectedRevision: 0 })
  ).rejects.toThrow();
  await f.t.run(async (ctx) => {
    const row = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", f.workspaceId).eq("userId", f.userId))
      .unique();
    await ctx.db.patch(row!._id, { active: false });
  });
  expect((await reader.fetch(avatar!.downloadPath)).status).toBe(403);
  await f.t.run(async (ctx) => {
    const rows = await ctx.db.query("workspaceMembers").collect();
    await Promise.all(rows.map((row) => ctx.db.patch(row._id, { active: row.userId === f.userId })));
  });
  expect((await reader.fetch(avatar!.downloadPath)).status).toBe(403);
  const other = await f.t.run((ctx) =>
    ctx.db.insert("workspaces", { name: "Other", slug: "other", metadataRevision: 0 })
  );
  expect((await reader.fetch(`/assets/${ticket.assetId}?workspace=${other}`)).status).toBe(403);
  await expect(reader.mutation(internal.assets.index.commit, { assetId: ticket.assetId })).rejects.toThrow();
});

test("purpose isolation rejects non-avatar null workspace and expired avatar recovery", async () => {
  const f = await workspaceJourney();
  const ticket = await upload(f, 0);
  await f.owner.action(api.assets.upload.finalize, ticket);
  await f.t.run((ctx) => ctx.db.patch(ticket.assetId, { purpose: "workspaceLogo" }));
  expect((await f.owner.fetch(`/assets/${ticket.assetId}`)).status).toBe(403);
  await f.t.run((ctx) => ctx.db.patch(ticket.assetId, { purpose: "userAvatar", projectId: f.projectId }));
  expect((await f.owner.fetch(`/assets/${ticket.assetId}`)).status).toBe(403);
  await f.t.run((ctx) => ctx.db.patch(ticket.assetId, { projectId: null }));
  await expect(f.owner.mutation(api.assets.index.remove, { assetId: ticket.assetId })).rejects.toThrow("profile");
  await f.owner.mutation(api.identity.avatar.remove, { assetId: ticket.assetId, expectedRevision: 1 });
  await f.t.run((ctx) => ctx.db.patch(ticket.assetId, { expiresAt: 0 }));
  await expect(
    f.owner.mutation(api.identity.avatar.restore, { assetId: ticket.assetId, expectedRevision: 2 })
  ).rejects.toThrow("no longer");
});
