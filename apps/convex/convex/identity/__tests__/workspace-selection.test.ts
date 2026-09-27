import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
test("workspace selection preserves current preferences, returns current slug and makes old forms stale", async () => {
  const f = await workspaceJourney();
  const before = await f.owner.query(api.identity.profile.get, {});
  await f.owner.mutation(api.identity.preferences.save, {
    expectedRevision: before.revision,
    preferences: { ...before.preferences, language: "id", theme: { theme: "dark" } },
  });
  await f.t.run((ctx) => ctx.db.patch(f.workspaceId, { slug: "renamed-selection" }));
  const selected = await f.owner.mutation(api.identity.preferences.selectWorkspace, { workspaceId: f.workspaceId });
  expect(selected).toEqual({ workspaceId: f.workspaceId, slug: "renamed-selection" });
  const after = await f.owner.query(api.identity.profile.get, {});
  expect(after.preferences.language).toBe("id");
  expect(after.preferences.theme).toEqual({ theme: "dark" });
  expect(after.preferences.lastWorkspaceId).toBe(f.workspaceId);
  expect(after.revision).toBe(before.revision + 2);
  await f.owner.mutation(api.identity.preferences.selectWorkspace, { workspaceId: f.workspaceId });
  expect((await f.owner.query(api.identity.profile.get, {})).revision).toBe(after.revision);
  await expect(
    f.owner.mutation(api.identity.preferences.save, {
      expectedRevision: before.revision + 1,
      preferences: before.preferences,
    })
  ).rejects.toThrow("changed");
});
test("revoked membership and restricted session reject selection without preference writes", async () => {
  const f = await workspaceJourney();
  const before = await f.owner.query(api.identity.profile.get, {});
  await f.t.run(async (ctx) => {
    const m = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", f.workspaceId).eq("userId", f.userId))
      .unique();
    if (!m) throw new Error("fixture");
    await ctx.db.patch(m._id, { active: false });
  });
  await expect(
    f.owner.mutation(api.identity.preferences.selectWorkspace, { workspaceId: f.workspaceId })
  ).rejects.toThrow();
  expect(await f.owner.query(api.identity.profile.get, {})).toEqual(before);
  await f.t.run((ctx) => ctx.db.insert("accountRestrictions", { userId: f.userId, deactivatedAt: Date.now() }));
  await expect(
    f.owner.mutation(api.identity.preferences.selectWorkspace, { workspaceId: f.workspaceId })
  ).rejects.toThrow();
});
