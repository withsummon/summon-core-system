import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "../../../_generated/api";
import { workspaceJourney } from "../../../../test-support/fixtures";
afterEach(() => vi.unstubAllEnvs());
test("anonymous policy is safe and disabling creation denies even instance administrators without writes", async () => {
  vi.stubEnv("DISABLE_WORKSPACE_CREATION", "0");
  const f = await workspaceJourney();
  vi.stubEnv("DISABLE_WORKSPACE_CREATION", "1");
  await expect(
    f.owner.mutation(api.workspaces.index.create, { name: "Ordinary blocked", slug: "ordinary-blocked" })
  ).rejects.toThrow("not allowed");
  await f.t.run((ctx) => ctx.db.patch(f.userId, { email: "operator@example.test", emailVerificationTime: 1 }));
  await f.t.mutation(internal.identity.instance.index.bootstrap, {
    userId: f.userId,
    expectedEmail: "operator@example.test",
  });
  vi.stubEnv("DISABLE_WORKSPACE_CREATION", "1");
  expect(await f.t.query(api.identity.instance.configuration.availability, {})).toEqual({
    isWorkspaceCreationDisabled: true,
  });
  const before = await f.t.run(async (ctx) => ({
    workspaces: (await ctx.db.query("workspaces").collect()).length,
    members: (await ctx.db.query("workspaceMembers").collect()).length,
  }));
  await expect(
    f.owner.mutation(api.workspaces.index.create, { name: "Blocked", slug: "blocked-policy" })
  ).rejects.toThrow("not allowed");
  expect(
    await f.t.run(async (ctx) => ({
      workspaces: (await ctx.db.query("workspaces").collect()).length,
      members: (await ctx.db.query("workspaceMembers").collect()).length,
    }))
  ).toEqual(before);
});
test("enabled creation preserves atomic slug and admin membership, and restricted identities remain denied", async () => {
  vi.stubEnv("DISABLE_WORKSPACE_CREATION", "0");
  const f = await workspaceJourney();
  expect(await f.t.query(api.identity.instance.configuration.availability, {})).toEqual({
    isWorkspaceCreationDisabled: false,
  });
  const id = await f.owner.mutation(api.workspaces.index.create, { name: "Allowed", slug: "allowed-policy" });
  const membership = await f.t.run((ctx) =>
    ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", id).eq("userId", f.userId))
      .unique()
  );
  expect(membership?.role).toBe("admin");
  await expect(
    f.owner.mutation(api.workspaces.index.create, { name: "Duplicate", slug: "allowed-policy" })
  ).rejects.toThrow("taken");
  await f.t.run((ctx) => ctx.db.insert("accountRestrictions", { userId: f.userId, deactivatedAt: Date.now() }));
  await expect(
    f.owner.mutation(api.workspaces.index.create, { name: "Restricted", slug: "restricted-policy" })
  ).rejects.toThrow();
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("workspaces")
        .withIndex("by_slug", (q) => q.eq("slug", "restricted-policy"))
        .unique()
    )
  ).toBeNull();
});
