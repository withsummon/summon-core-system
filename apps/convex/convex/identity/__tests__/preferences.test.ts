import { expect, test } from "vitest";
import { api, internal } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { defaultPreferences } from "../preferences_fields";

test("private preferences initialize defaults and share profile revision without changing public identity", async () => {
  const { t, owner, workspaceId } = await workspaceJourney();
  expect((await owner.query(api.identity.profile.get, {})).preferences).toEqual(defaultPreferences);
  const preferences = {
    ...defaultPreferences,
    language: "id",
    lastWorkspaceId: workspaceId,
    onboarding: { ...defaultPreferences.onboarding, profileComplete: true },
  };
  await owner.mutation(api.identity.preferences.save, { expectedRevision: 0, preferences });
  expect(await owner.query(api.identity.index.current, {})).toMatchObject({ name: "Owner" });
  await expect(
    owner.mutation(api.identity.profile.save, {
      expectedRevision: 0,
      firstName: "A",
      lastName: "B",
      displayName: "AB",
      timezone: "UTC",
    })
  ).rejects.toThrow("changed");
  await owner.mutation(api.identity.profile.save, {
    expectedRevision: 1,
    firstName: "A",
    lastName: "B",
    displayName: "AB",
    timezone: "UTC",
  });
  expect(await owner.query(api.identity.profile.get, {})).toMatchObject({ revision: 2, preferences });
  await expect(owner.mutation(api.identity.preferences.save, { expectedRevision: 1, preferences })).rejects.toThrow(
    "changed"
  );
  const otherId = await t.run((ctx) => ctx.db.insert("users", { name: "Other" }));
  expect((await t.withIdentity({ subject: otherId }).query(api.identity.profile.get, {})).preferences).toEqual(
    defaultPreferences
  );
  await expect(t.mutation(api.identity.preferences.save, { expectedRevision: 0, preferences })).rejects.toThrow(
    "Sign in"
  );
});

test("onboarding declarations do not grant workspace access and revoked membership blocks last workspace selection", async () => {
  const { t, owner, workspaceId, userId } = await workspaceJourney();
  const otherId = await t.run((ctx) => ctx.db.insert("users", {}));
  const other = t.withIdentity({ subject: otherId });
  const preferences = { ...defaultPreferences, isOnboarded: true, tourCompleted: true };
  await other.mutation(api.identity.preferences.save, { expectedRevision: 0, preferences });
  await expect(
    other.mutation(api.identity.preferences.save, {
      expectedRevision: 1,
      preferences: { ...preferences, lastWorkspaceId: workspaceId },
    })
  ).rejects.toThrow();
  await t.run(async (ctx) => {
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", userId))
      .unique();
    await ctx.db.delete(membership!._id);
  });
  await expect(
    owner.mutation(api.identity.preferences.save, {
      expectedRevision: 0,
      preferences: { ...preferences, lastWorkspaceId: workspaceId },
    })
  ).rejects.toThrow();
  expect((await owner.query(api.identity.profile.get, {})).revision).toBe(0);
});

test.each([
  { startOfWeek: 7 },
  { startOfWeek: 0.5 },
  { language: " " },
  { jobRole: "x".repeat(301) },
  { theme: { theme: "unsupported" } },
  { theme: { primary: "url(https://example.com)" } },
])("invalid preferences are atomic: %j", async (patch) => {
  const { owner } = await workspaceJourney();
  await expect(
    owner.mutation(api.identity.preferences.save, {
      expectedRevision: 0,
      preferences: { ...defaultPreferences, ...patch },
    })
  ).rejects.toThrow();
  expect((await owner.query(api.identity.profile.get, {})).revision).toBe(0);
});

test("bounded backfill preserves stored preferences and revisions and converges", async () => {
  const { t, owner, userId } = await workspaceJourney();
  await t.run((ctx) =>
    ctx.db.insert("userProfiles", { userId, firstName: "Old", lastName: "Profile", timezone: "UTC", revision: 4 })
  );
  expect((await owner.query(api.identity.profile.get, {})).preferences).toEqual(defaultPreferences);
  expect(await t.mutation(internal.identity.migrations.preferences, { cursor: null })).toMatchObject({
    processed: 1,
    changed: 1,
    isDone: true,
  });
  const preferences = {
    ...defaultPreferences,
    language: "id",
    theme: { theme: "custom", primary: "#abc", darkPalette: true },
  };
  await owner.mutation(api.identity.preferences.save, { expectedRevision: 4, preferences });
  expect(await t.mutation(internal.identity.migrations.preferences, { cursor: null })).toMatchObject({
    changed: 0,
    isDone: true,
  });
  expect(await owner.query(api.identity.profile.get, {})).toMatchObject({ firstName: "Old", revision: 5, preferences });
});
