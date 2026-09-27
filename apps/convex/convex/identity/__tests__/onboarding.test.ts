import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
test("explicit onboarding completion uses current workspace access and preserves preferences", async () => {
  const f = await workspaceJourney();
  await f.owner.mutation(api.identity.profile.save, {
    displayName: "Owner",
    firstName: "First",
    lastName: "",
    timezone: "UTC",
    expectedRevision: 0,
  });
  const profile = await f.owner.query(api.identity.profile.get, {});
  await f.owner.mutation(api.identity.preferences.save, {
    expectedRevision: profile.revision,
    preferences: { ...profile.preferences, language: "id", tourCompleted: true },
  });
  await expect(
    f.owner.mutation(api.identity.onboarding.complete, { expectedRevision: 1, workspaceId: f.workspaceId })
  ).rejects.toThrow("changed");
  await f.t.run((ctx) => ctx.db.patch(f.workspaceId, { slug: "renamed" }));
  expect(
    await f.owner.mutation(api.identity.onboarding.complete, { expectedRevision: 2, workspaceId: f.workspaceId })
  ).toEqual({ workspaceId: f.workspaceId, slug: "renamed" });
  const saved = await f.owner.query(api.identity.profile.get, {});
  expect(saved.preferences).toMatchObject({
    language: "id",
    tourCompleted: true,
    isOnboarded: true,
    lastWorkspaceId: f.workspaceId,
    onboarding: { profileComplete: true, workspaceJoin: true, workspaceCreate: false },
  });
});
test("revoked workspace selection cannot complete onboarding", async () => {
  const f = await workspaceJourney();
  await f.owner.mutation(api.identity.profile.save, {
    displayName: "Owner",
    firstName: "First",
    lastName: "",
    timezone: "UTC",
    expectedRevision: 0,
  });
  await f.t.run(async (ctx) => {
    const rows = await ctx.db.query("workspaceMembers").collect();
    await ctx.db.patch(rows[0]._id, { active: false });
  });
  await expect(
    f.owner.mutation(api.identity.onboarding.complete, { expectedRevision: 1, workspaceId: f.workspaceId })
  ).rejects.toThrow();
  expect((await f.owner.query(api.identity.profile.get, {})).preferences.isOnboarded).toBe(false);
});
