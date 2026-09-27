import { createHash } from "node:crypto";
import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
const bytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6sQAAAABJRU5ErkJggg==",
  "base64"
);
const file = {
  name: "logo.png",
  contentType: "image/png",
  size: bytes.length,
  sha256: createHash("sha256").update(bytes).digest("base64"),
};
async function pending(f: Awaited<ReturnType<typeof workspaceJourney>>, revision: number) {
  const ticket = await f.owner.mutation(api.settings.logo.prepare, {
    workspaceId: f.workspaceId,
    expectedRevision: revision,
    ...file,
  });
  const storageId = await f.t.run((ctx) => ctx.storage.store(new Blob([bytes], { type: file.contentType })));
  return { assetId: ticket.assetId, storageId };
}
afterEach(() => vi.useRealTimers());
test("validated upload atomically replaces, removes and recovers a logo with shared workspace revision", async () => {
  const f = await workspaceJourney();
  const first = await pending(f, 0);
  await f.owner.action(api.assets.upload.finalize, first);
  expect(await f.owner.query(api.settings.logo.get, { workspaceId: f.workspaceId })).toMatchObject({
    revision: 1,
    logo: { id: first.assetId },
  });
  const second = await pending(f, 1);
  await f.owner.action(api.assets.upload.finalize, second);
  expect((await f.owner.fetch(`/assets/${first.assetId}`)).status).toBe(403);
  expect(
    await f.owner.query(api.settings.logo.removed, {
      workspaceId: f.workspaceId,
      paginationOpts: { cursor: null, numItems: 10 },
    })
  ).toMatchObject({ page: [{ id: first.assetId }] });
  await f.owner.mutation(api.settings.logo.restore, {
    workspaceId: f.workspaceId,
    assetId: first.assetId,
    expectedRevision: 2,
  });
  expect((await f.owner.fetch(`/assets/${first.assetId}`)).status).toBe(200);
  await expect(
    f.owner.mutation(api.settings.logo.remove, {
      workspaceId: f.workspaceId,
      assetId: second.assetId,
      expectedRevision: 3,
    })
  ).rejects.toThrow("changed");
  await expect(f.owner.mutation(api.assets.index.remove, { assetId: first.assetId })).rejects.toThrow("appearance");
  await f.owner.mutation(api.settings.logo.remove, {
    workspaceId: f.workspaceId,
    assetId: first.assetId,
    expectedRevision: 3,
  });
  expect(await f.owner.query(api.settings.logo.get, { workspaceId: f.workspaceId })).toMatchObject({
    revision: 4,
    logo: null,
  });
});
test("two captured uploads cannot overwrite a newer logo and stale restore cannot replace it", async () => {
  const f = await workspaceJourney();
  const slow = await pending(f, 0);
  const fast = await pending(f, 0);
  await f.owner.action(api.assets.upload.finalize, fast);
  await expect(f.owner.action(api.assets.upload.finalize, slow)).rejects.toThrow("changed");
  expect(await f.owner.query(api.settings.logo.get, { workspaceId: f.workspaceId })).toMatchObject({
    logo: { id: fast.assetId },
    revision: 1,
  });
  expect(await f.t.run((ctx) => ctx.db.get(slow.assetId))).toMatchObject({ status: "pending" });
  await expect(
    f.owner.mutation(api.settings.logo.restore, {
      workspaceId: f.workspaceId,
      assetId: fast.assetId,
      expectedRevision: 0,
    })
  ).rejects.toThrow("changed");
});
test("current administrator is required at prepare, async commit, remove and recovery; current members can read", async () => {
  const f = await workspaceJourney();
  const ticket = await pending(f, 0);
  await f.owner.mutation(internal.assets.index.claim, ticket);
  await f.t.run(async (ctx) => {
    const member = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", f.workspaceId).eq("userId", f.userId))
      .unique();
    await ctx.db.patch(member!._id, { role: "member" });
  });
  await expect(f.owner.mutation(internal.assets.index.commit, { assetId: ticket.assetId })).rejects.toThrow(
    "administrators"
  );
  await expect(pending(f, 0)).rejects.toThrow("administrators");
  await expect(
    f.owner.mutation(api.settings.logo.remove, {
      workspaceId: f.workspaceId,
      assetId: ticket.assetId,
      expectedRevision: 0,
    })
  ).rejects.toThrow("administrators");
  await expect(
    f.owner.mutation(api.settings.logo.restore, {
      workspaceId: f.workspaceId,
      assetId: ticket.assetId,
      expectedRevision: 0,
    })
  ).rejects.toThrow("administrators");
  expect(await f.owner.query(api.settings.logo.get, { workspaceId: f.workspaceId })).toMatchObject({
    canManage: false,
  });
  await expect(
    f.owner.query(api.settings.logo.removed, {
      workspaceId: f.workspaceId,
      paginationOpts: { cursor: null, numItems: 10 },
    })
  ).rejects.toThrow("administrators");
});
test("restore refuses another workspace and missing bytes; nonimages and outsiders fail", async () => {
  const f = await workspaceJourney();
  const ticket = await pending(f, 0);
  await f.owner.action(api.assets.upload.finalize, ticket);
  await f.owner.mutation(api.settings.logo.remove, {
    workspaceId: f.workspaceId,
    assetId: ticket.assetId,
    expectedRevision: 1,
  });
  const other = await f.owner.mutation(api.workspaces.index.create, { name: "Other", slug: "other-logo" });
  await expect(
    f.owner.mutation(api.settings.logo.restore, { workspaceId: other, assetId: ticket.assetId, expectedRevision: 0 })
  ).rejects.toThrow("not found");
  await f.t.run((ctx) => ctx.storage.delete(ticket.storageId));
  await expect(
    f.owner.mutation(api.settings.logo.restore, {
      workspaceId: f.workspaceId,
      assetId: ticket.assetId,
      expectedRevision: 2,
    })
  ).rejects.toThrow("no longer");
  await expect(
    f.owner.mutation(api.settings.logo.prepare, {
      workspaceId: f.workspaceId,
      expectedRevision: 2,
      ...file,
      contentType: "text/plain",
    })
  ).rejects.toThrow("image");
  const outsiderId = await f.t.run((ctx) => ctx.db.insert("users", {}));
  const outsider = await signedIn(f.t, outsiderId);
  await expect(outsider.query(api.settings.logo.get, { workspaceId: f.workspaceId })).rejects.toThrow();
});

test("expired recovery and spoofed images fail without changing the current logo", async () => {
  const f = await workspaceJourney();
  const ticket = await pending(f, 0);
  await f.owner.action(api.assets.upload.finalize, ticket);
  await f.owner.mutation(api.settings.logo.remove, {
    workspaceId: f.workspaceId,
    assetId: ticket.assetId,
    expectedRevision: 1,
  });
  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + 8 * 24 * 60 * 60 * 1000);
  await expect(
    f.owner.mutation(api.settings.logo.restore, {
      workspaceId: f.workspaceId,
      assetId: ticket.assetId,
      expectedRevision: 2,
    })
  ).rejects.toThrow("no longer");
  vi.useRealTimers();
  const bad = new Blob(["not image"], { type: "image/png" });
  const badTicket = await f.owner.mutation(api.settings.logo.prepare, {
    workspaceId: f.workspaceId,
    expectedRevision: 2,
    ...file,
    size: bad.size,
    sha256: createHash("sha256").update("not image").digest("base64"),
  });
  const storageId = await f.t.run((ctx) => ctx.storage.store(bad));
  await expect(f.owner.action(api.assets.upload.finalize, { assetId: badTicket.assetId, storageId })).rejects.toThrow(
    "declared type"
  );
  expect(await f.t.run((ctx) => ctx.db.system.get(storageId))).toBeNull();
  expect(await f.owner.query(api.settings.logo.get, { workspaceId: f.workspaceId })).toMatchObject({
    revision: 2,
    logo: null,
  });
});

test("an intervening metadata save invalidates the upload without overwriting settings or the logo", async () => {
  const f = await workspaceJourney();
  const ticket = await pending(f, 0);
  const {
    revision,
    canManage: _canManage,
    ...settings
  } = await f.owner.query(api.settings.index.metadata, { workspaceId: f.workspaceId });
  await f.owner.mutation(api.settings.index.update, {
    workspaceId: f.workspaceId,
    ...settings,
    name: "Updated workspace",
    expectedRevision: revision,
  });
  await expect(f.owner.action(api.assets.upload.finalize, ticket)).rejects.toThrow("changed");
  expect(await f.owner.query(api.settings.index.metadata, { workspaceId: f.workspaceId })).toMatchObject({
    name: "Updated workspace",
    revision: 1,
  });
  expect(await f.owner.query(api.settings.logo.get, { workspaceId: f.workspaceId })).toMatchObject({
    logo: null,
    revision: 1,
  });
});
