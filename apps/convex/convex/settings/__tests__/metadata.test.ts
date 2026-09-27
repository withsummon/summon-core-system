import { expect, test } from "vitest";
import { api, internal } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
const settings = {
  name: "Workspace renamed",
  slug: "New_Workspace",
  organizationSize: null,
  timezone: "Asia/Jakarta",
  industry: "Technology",
  description: "Shared workspace",
  currency: "IDR",
  workweek: [],
};
test("rename preserves workspace identity and domain links, updates canonical address and rejects old address", async () => {
  const f = await workspaceJourney();
  const result = await f.owner.mutation(api.settings.index.update, {
    workspaceId: f.workspaceId,
    ...settings,
    expectedRevision: 0,
  });
  expect(result).toEqual({ slug: "New_Workspace", revision: 1 });
  expect(
    (await f.owner.query(api.navigation.address.resolveWorkspace, { workspaceSlug: result.slug })).workspace._id
  ).toBe(f.workspaceId);
  await expect(
    f.owner.query(api.navigation.address.resolveWorkspace, { workspaceSlug: "workspace" })
  ).rejects.toThrow();
  expect((await f.owner.query(api.projects.index.list, { workspaceId: f.workspaceId }))[0]._id).toBe(f.projectId);
  expect((await f.owner.query(api.settings.index.get, { workspaceId: f.workspaceId })).timezone).toBe("Asia/Jakarta");
  expect(await f.owner.query(api.settings.index.metadata, { workspaceId: f.workspaceId })).toEqual({
    ...settings,
    revision: 1,
    canManage: true,
  });
});
test("stale settings, slug collisions and invalid data fail atomically while legacy writes advance the same revision", async () => {
  const f = await workspaceJourney();
  await f.owner.mutation(api.workspaces.index.create, { name: "Occupied", slug: "occupied" });
  await expect(
    f.owner.mutation(api.settings.index.update, {
      workspaceId: f.workspaceId,
      ...settings,
      slug: "occupied",
      expectedRevision: 0,
    })
  ).rejects.toThrow("taken");
  const { slug, ...fields } = settings;
  await f.owner.mutation(api.settings.index.save, { workspaceId: f.workspaceId, ...fields });
  await expect(
    f.owner.mutation(api.settings.index.update, { workspaceId: f.workspaceId, ...settings, expectedRevision: 0 })
  ).rejects.toThrow("changed");
  await expect(
    f.owner.mutation(api.settings.index.update, {
      workspaceId: f.workspaceId,
      ...settings,
      timezone: "invalid",
      expectedRevision: 1,
    })
  ).rejects.toThrow("timezone");
  expect(await f.owner.query(api.settings.index.get, { workspaceId: f.workspaceId })).toMatchObject({
    slug: "workspace",
    timezone: settings.timezone,
  });
  expect(await f.owner.query(api.settings.index.slugAvailability, { workspaceId: f.workspaceId, slug })).toEqual({
    available: true,
  });
});
test("member and guest reads remain private to current workspace membership; only administrators rename", async () => {
  const f = await workspaceJourney();
  const userId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Reader" }));
  const reader = await signedIn(f.t, userId);
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role: "member" });
  expect(await reader.query(api.settings.index.metadata, { workspaceId: f.workspaceId })).toMatchObject({
    revision: 0,
    canManage: false,
  });
  await expect(
    reader.mutation(api.settings.index.update, { workspaceId: f.workspaceId, ...settings, expectedRevision: 0 })
  ).rejects.toThrow("administrators");
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role: "guest" });
  await expect(
    reader.mutation(api.settings.index.update, { workspaceId: f.workspaceId, ...settings, expectedRevision: 0 })
  ).rejects.toThrow();
  await f.owner.mutation(api.workspaces.index.revokeMember, { workspaceId: f.workspaceId, userId });
  await expect(reader.query(api.settings.index.metadata, { workspaceId: f.workspaceId })).rejects.toThrow();
});
test.each(["api", "settings", "bad slug", "a".repeat(49)])("create and rename share rejected slug %s", async (slug) => {
  const f = await workspaceJourney();
  await expect(f.owner.mutation(api.workspaces.index.create, { name: "Valid", slug })).rejects.toThrow("slug");
  await expect(
    f.owner.mutation(api.settings.index.update, { workspaceId: f.workspaceId, ...settings, slug, expectedRevision: 0 })
  ).rejects.toThrow("slug");
});
test.each(["___", "https://example.test", "example.com", "127.0.0.1", "a".repeat(81)])(
  "create and settings share rejected name %s",
  async (name) => {
    const f = await workspaceJourney();
    await expect(f.owner.mutation(api.workspaces.index.create, { name, slug: "valid" })).rejects.toThrow();
    await expect(
      f.owner.mutation(api.settings.index.update, {
        workspaceId: f.workspaceId,
        ...settings,
        name,
        expectedRevision: 0,
      })
    ).rejects.toThrow();
  }
);
test("bounded metadata backfill preserves existing revisions and second complete scan makes no changes", async () => {
  const f = await workspaceJourney();
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.workspaceId, { metadataRevision: undefined });
    await ctx.db.insert("workspaces", { name: "Existing", slug: "existing", metadataRevision: 7 });
  });
  const first = await f.t.mutation(internal.settings.index.backfillMetadata, { cursor: null });
  expect(first).toMatchObject({ processed: 2, changed: 1, isDone: true });
  expect(await f.t.mutation(internal.settings.index.backfillMetadata, { cursor: null })).toMatchObject({
    processed: 2,
    changed: 0,
    isDone: true,
  });
  expect(
    (
      await f.t.run((ctx) =>
        ctx.db
          .query("workspaces")
          .withIndex("by_slug", (q) => q.eq("slug", "existing"))
          .unique()
      )
    )?.metadataRevision
  ).toBe(7);
});
