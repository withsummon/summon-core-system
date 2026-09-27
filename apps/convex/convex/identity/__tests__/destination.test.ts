import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
test("destination uses selected current slug then oldest workspace, not alphabetical or membership creation", async () => {
  const f = await workspaceJourney();
  const newer = await f.owner.mutation(api.workspaces.index.create, {
    name: "Alphabetically first",
    slug: "aaa-newer",
  });
  await f.owner.mutation(api.identity.preferences.selectWorkspace, { workspaceId: newer });
  await f.t.run((ctx) => ctx.db.patch(newer, { slug: "renamed-newer" }));
  expect((await f.owner.query(api.identity.preferences.destination, {})).workspace).toEqual({
    id: newer,
    slug: "renamed-newer",
  });
  await f.t.run(async (ctx) => {
    const m = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", newer).eq("userId", f.userId))
      .unique();
    if (!m) throw new Error("fixture");
    await ctx.db.patch(m._id, { active: false });
  });
  const destination = await f.owner.query(api.identity.preferences.destination, {});
  expect(destination.workspace?.id).toBe(f.workspaceId);
  expect(destination.onboardingComplete).toBe(false);
  await f.owner.mutation(api.identity.onboarding.complete, {
    workspaceId: f.workspaceId,
    expectedRevision: (await f.owner.query(api.identity.profile.get, {})).revision,
  });
  expect((await f.owner.query(api.identity.preferences.destination, {})).onboardingComplete).toBe(true);
});
test("no membership stays explicit null and anonymous or restricted accounts cannot resolve", async () => {
  const f = await workspaceJourney();
  const id = await f.t.run((ctx) => ctx.db.insert("users", { name: "New" }));
  const actor = await signedIn(f.t, id);
  expect(await actor.query(api.identity.preferences.destination, {})).toEqual({
    workspace: null,
    onboardingComplete: false,
  });
  await expect(f.t.query(api.identity.preferences.destination, {})).rejects.toThrow();
  await f.t.run((ctx) => ctx.db.insert("accountRestrictions", { userId: id, deactivatedAt: Date.now() }));
  await expect(actor.query(api.identity.preferences.destination, {})).rejects.toThrow();
});
