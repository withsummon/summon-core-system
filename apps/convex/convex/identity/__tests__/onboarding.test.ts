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

test("preserved incoming join completes without inventing creation or invitation steps", async () => {
  const f = await workspaceJourney();
  await expect(
    f.owner.mutation(api.identity.onboarding.completePreserved, {
      expectedRevision: 0,
      workspaceId: f.workspaceId,
      inviteStepCompleted: false,
    })
  ).rejects.toThrow("profile first");
  await f.owner.mutation(api.identity.profile.completeProfile, {
    displayName: "Owner",
    firstName: "",
    lastName: "",
    timezone: "UTC",
    expectedRevision: 0,
  });
  await expect(
    f.owner.mutation(api.identity.onboarding.completePreserved, {
      expectedRevision: 1,
      workspaceId: f.workspaceId,
      inviteStepCompleted: true,
    })
  ).rejects.toThrow("workspace creation");
  await f.owner.mutation(api.identity.onboarding.completePreserved, {
    expectedRevision: 1,
    workspaceId: f.workspaceId,
    inviteStepCompleted: false,
  });
  const profile = await f.owner.query(api.identity.profile.get, {});
  expect(profile.preferences.onboarding).toEqual({
    profileComplete: true,
    workspaceCreate: false,
    workspaceJoin: false,
    workspaceInvite: false,
  });
  expect(profile.preferences.isOnboarded).toBe(true);
});

test.each(["Just myself", "2-10"])(
  "creation records actual %s journey and completion preserves flags",
  async (organizationSize) => {
    const f = await workspaceJourney();
    await f.owner.mutation(api.identity.profile.completeProfile, {
      displayName: "Owner",
      firstName: "",
      lastName: "",
      timezone: "UTC",
      expectedRevision: 0,
    });
    const workspaceId = await f.owner.mutation(api.workspaces.index.create, {
      name: "Created workspace",
      slug: "onboarding-created",
      organizationSize,
      onboardingRevision: 1,
    });
    const created = await f.owner.query(api.identity.profile.get, {});
    expect(created.revision).toBe(2);
    expect(created.preferences.lastWorkspaceId).toBe(workspaceId);
    expect(created.preferences.onboarding.workspaceCreate).toBe(organizationSize !== "Just myself");
    await expect(
      f.owner.mutation(api.identity.onboarding.completePreserved, {
        workspaceId,
        expectedRevision: 1,
        inviteStepCompleted: false,
      })
    ).rejects.toThrow("changed");
    await f.owner.mutation(api.identity.onboarding.completePreserved, {
      workspaceId,
      expectedRevision: 2,
      inviteStepCompleted: organizationSize !== "Just myself",
    });
    const completed = await f.owner.query(api.identity.profile.get, {});
    expect(completed.preferences.onboarding.workspaceInvite).toBe(organizationSize !== "Just myself");
    expect(completed.preferences.onboarding.workspaceJoin).toBe(false);
    expect(completed.preferences.isOnboarded).toBe(true);
  }
);

test("stale creation rolls back workspace and membership; revoked selection cannot finish", async () => {
  const f = await workspaceJourney();
  await f.owner.mutation(api.identity.profile.completeProfile, {
    displayName: "Owner",
    firstName: "",
    lastName: "",
    timezone: "UTC",
    expectedRevision: 0,
  });
  await expect(
    f.owner.mutation(api.workspaces.index.create, {
      name: "Stale workspace",
      slug: "stale-onboarding",
      organizationSize: "Just myself",
      onboardingRevision: 0,
    })
  ).rejects.toThrow("changed");
  expect(
    await f.t.run(
      async (ctx) =>
        (await ctx.db.query("workspaces").collect()).filter((row) => row.slug === "stale-onboarding").length
    )
  ).toBe(0);
  await f.t.run(async (ctx) => {
    const row = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", f.workspaceId).eq("userId", f.userId))
      .unique();
    if (row) await ctx.db.patch(row._id, { active: false });
  });
  await expect(
    f.owner.mutation(api.identity.onboarding.completePreserved, {
      workspaceId: f.workspaceId,
      expectedRevision: 1,
      inviteStepCompleted: false,
    })
  ).rejects.toThrow();
  expect((await f.owner.query(api.identity.profile.get, {})).preferences.isOnboarded).toBe(false);
});
