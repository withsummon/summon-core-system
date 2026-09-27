import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
test("no override has canonical defaults; save/reset share revision and preserve order", async () => {
  const f = await workspaceJourney();
  const initial = await f.owner.query(api.projects.navigation.get, { projectId: f.projectId });
  expect(initial).toEqual({
    navigation: { defaultTab: "work_items", hiddenTabs: [] },
    hasOverride: false,
    revision: 0,
  });
  const before = await f.t.run((ctx) =>
    ctx.db
      .query("projectUserProperties")
      .withIndex("by_project_user", (q) => q.eq("projectId", f.projectId).eq("userId", f.userId))
      .unique()
  );
  await f.owner.mutation(api.projects.navigation.save, {
    projectId: f.projectId,
    expectedRevision: 0,
    navigation: { defaultTab: "overview", hiddenTabs: ["cycles", "modules"] },
  });
  const saved = await f.owner.query(api.projects.navigation.get, { projectId: f.projectId });
  expect(saved).toMatchObject({
    hasOverride: true,
    revision: 1,
    navigation: { defaultTab: "overview", hiddenTabs: ["cycles", "modules"] },
  });
  await expect(
    f.owner.mutation(api.projects.navigation.reset, { projectId: f.projectId, expectedRevision: 0 })
  ).rejects.toThrow("changed");
  await f.owner.mutation(api.projects.navigation.reset, { projectId: f.projectId, expectedRevision: 1 });
  expect(await f.owner.query(api.projects.navigation.get, { projectId: f.projectId })).toEqual({
    ...initial,
    revision: 2,
  });
  const after = await f.t.run((ctx) => ctx.db.get(before!._id));
  expect(after?.sortOrder).toBe(before?.sortOrder);
  expect(after).not.toHaveProperty("navigation");
});
test("guest owns private preferences; revoke/rejoin retains them without admin disclosure", async () => {
  const f = await workspaceJourney();
  const userId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Guest" }));
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role: "guest" });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId, role: "guest" });
  const guest = await signedIn(f.t, userId);
  await guest.mutation(api.projects.navigation.save, {
    projectId: f.projectId,
    expectedRevision: 0,
    navigation: { defaultTab: "cycles", hiddenTabs: ["work_items"] },
  });
  expect((await f.owner.query(api.projects.navigation.get, { projectId: f.projectId })).hasOverride).toBe(false);
  await f.owner.mutation(api.projects.index.revokeMember, { projectId: f.projectId, userId });
  await expect(guest.query(api.projects.navigation.get, { projectId: f.projectId })).rejects.toThrow();
  await expect(
    guest.mutation(api.projects.navigation.reset, { projectId: f.projectId, expectedRevision: 1 })
  ).rejects.toThrow();
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId, role: "guest" });
  expect((await guest.query(api.projects.navigation.get, { projectId: f.projectId })).navigation.defaultTab).toBe(
    "cycles"
  );
});
test("navigation changes and adjacent project moves cannot overwrite captured shared revisions", async () => {
  const f = await workspaceJourney();
  const other = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Other",
    identifier: "OTHER",
  });
  await f.owner.mutation(api.projects.navigation.save, {
    projectId: f.projectId,
    expectedRevision: 0,
    navigation: { defaultTab: "views", hiddenTabs: [] },
  });
  await expect(
    f.owner.mutation(api.projects.order.move, {
      projectId: other,
      expectedRevision: 0,
      neighborId: f.projectId,
      expectedNeighborRevision: 0,
      direction: "down",
    })
  ).rejects.toThrow("changed");
  await f.owner.mutation(api.projects.order.move, {
    projectId: other,
    expectedRevision: 0,
    neighborId: f.projectId,
    expectedNeighborRevision: 1,
    direction: "down",
  });
  await expect(
    f.owner.mutation(api.projects.navigation.save, {
      projectId: f.projectId,
      expectedRevision: 1,
      navigation: { defaultTab: "cycles", hiddenTabs: [] },
    })
  ).rejects.toThrow("changed");
  expect((await f.owner.query(api.projects.navigation.get, { projectId: f.projectId })).navigation.defaultTab).toBe(
    "views"
  );
});
test("duplicates, archived projects and missing initialized owner reject explicitly", async () => {
  const f = await workspaceJourney();
  await expect(
    f.owner.mutation(api.projects.navigation.save, {
      projectId: f.projectId,
      expectedRevision: 0,
      navigation: { defaultTab: "work_items", hiddenTabs: ["views", "views"] },
    })
  ).rejects.toThrow("distinct");
  await f.t.run((ctx) => ctx.db.patch(f.projectId, { archived: true }));
  await expect(f.owner.query(api.projects.navigation.get, { projectId: f.projectId })).rejects.toThrow();
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.projectId, { archived: false });
    const row = await ctx.db
      .query("projectUserProperties")
      .withIndex("by_project_user", (q) => q.eq("projectId", f.projectId).eq("userId", f.userId))
      .unique();
    await ctx.db.delete(row!._id);
  });
  await expect(f.owner.query(api.projects.navigation.get, { projectId: f.projectId })).rejects.toThrow(
    "not initialized"
  );
});
