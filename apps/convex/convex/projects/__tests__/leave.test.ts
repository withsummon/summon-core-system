import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
test.each(["member", "guest"] as const)(
  "%s can leave archived projects while keeping workspace access",
  async (role) => {
    const f = await workspaceJourney();
    const userId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Leaver" }));
    const actor = await signedIn(f.t, userId);
    await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role });
    await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId, role });
    await f.t.run((ctx) => ctx.db.patch(f.projectId, { archived: true }));
    await actor.mutation(api.projects.index.leave, { projectId: f.projectId });
    expect(await actor.query(api.workspaces.index.list, {})).toHaveLength(1);
    await expect(actor.mutation(api.projects.index.leave, { projectId: f.projectId })).rejects.toThrow("access");
  }
);
test("final project administrator is protected in archive and workspace membership is still required", async () => {
  const f = await workspaceJourney();
  await f.t.run((ctx) => ctx.db.patch(f.projectId, { archived: true }));
  await expect(f.owner.mutation(api.projects.index.leave, { projectId: f.projectId })).rejects.toThrow(
    "project administrator"
  );
  const outsiderId = await f.t.run(async (ctx) => {
    const id = await ctx.db.insert("users", { name: "Stale member" });
    await ctx.db.insert("projectMembers", {
      workspaceId: f.workspaceId,
      projectId: f.projectId,
      userId: id,
      role: "member",
      active: true,
    });
    return id;
  });
  const outsider = await signedIn(f.t, outsiderId);
  await expect(outsider.mutation(api.projects.index.leave, { projectId: f.projectId })).rejects.toThrow("workspace");
});
