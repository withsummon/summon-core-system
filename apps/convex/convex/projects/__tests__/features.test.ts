import { expect, test } from "vitest";
import { api, internal } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
const defaults = { cycles: false, modules: false, views: false, pages: true };
test("source defaults, atomic intake initialization and shared metadata CAS preserve data when disabled", async () => {
  const f = await workspaceJourney();
  const current = await f.owner.query(api.projects.features.get, { projectId: f.projectId });
  expect(current.features).toEqual({ ...defaults, intake: false });
  const args = {
    projectId: f.projectId,
    expectedRevision: current.revision,
    features: { ...defaults, cycles: true },
    intake: true,
  };
  await f.owner.mutation(api.projects.features.save, args);
  const intake = await f.owner.query(api.intakes.index.getConfig, { projectId: f.projectId });
  expect(intake.intake?.isDefault).toBe(true);
  await expect(f.owner.mutation(api.projects.features.save, args)).rejects.toThrow("changed");
  await f.owner.mutation(api.projects.features.save, {
    ...args,
    expectedRevision: current.revision + 1,
    intake: false,
  });
  expect((await f.owner.query(api.intakes.index.getConfig, { projectId: f.projectId })).intake?._id).toBe(
    intake.intake?._id
  );
});
test("workspace administrator can configure without project access; ordinary member cannot, archive and restriction deny", async () => {
  const f = await workspaceJourney();
  const userId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Administrator" }));
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role: "admin" });
  const actor = await signedIn(f.t, userId);
  const info = await actor.query(api.projects.features.get, { projectId: f.projectId });
  await actor.mutation(api.projects.features.save, {
    projectId: f.projectId,
    expectedRevision: info.revision,
    features: defaults,
    intake: false,
  });
  await expect(actor.query(api.projects.settings.get, { projectId: f.projectId })).rejects.toThrow();
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role: "member" });
  await expect(
    actor.mutation(api.projects.features.save, {
      projectId: f.projectId,
      expectedRevision: info.revision + 1,
      features: defaults,
      intake: false,
    })
  ).rejects.toThrow("administrators");
  await f.t.run((ctx) => ctx.db.patch(f.projectId, { archived: true }));
  await expect(f.owner.query(api.projects.features.get, { projectId: f.projectId })).rejects.toThrow("unavailable");
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.projectId, { archived: false });
    await ctx.db.insert("accountRestrictions", { userId: f.userId, deactivatedAt: Date.now() });
  });
  await expect(
    f.owner.mutation(api.projects.features.save, {
      projectId: f.projectId,
      expectedRevision: 1,
      features: defaults,
      intake: false,
    })
  ).rejects.toThrow();
});
test("additive backfill is explicit, idempotent and preserves existing intake setting", async () => {
  const f = await workspaceJourney();
  await f.t.run((ctx) => ctx.db.patch(f.projectId, { features: undefined, intakeEnabled: true }));
  await expect(f.owner.query(api.projects.features.get, { projectId: f.projectId })).rejects.toThrow("migration");
  expect((await f.t.mutation(internal.projects.features.backfill, { cursor: null })).changed).toBe(1);
  expect((await f.owner.query(api.projects.features.get, { projectId: f.projectId })).features).toEqual({
    ...defaults,
    intake: true,
  });
  expect((await f.t.mutation(internal.projects.features.backfill, { cursor: null })).changed).toBe(0);
});
