import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
import { MAX_ATOMIC_PROJECT_MEMBERSHIPS } from "../index";
async function joiner() {
  const f = await workspaceJourney();
  const userId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Joining member" }));
  const actor = await signedIn(f.t, userId);
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role: "member" });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId, role: "member" });
  return { ...f, memberId: userId, actor };
}
test("workspace leave preserves unrelated workspace access and content, deactivating archived project memberships too", async () => {
  const f = await joiner();
  const other = await f.actor.mutation(api.workspaces.index.create, { name: "Other workspace", slug: "other" });
  const otherProject = await f.actor.mutation(api.projects.index.create, {
    workspaceId: other,
    name: "Other project",
    identifier: "OTHER",
  });
  await f.t.run((ctx) => ctx.db.patch(f.projectId, { archived: true }));
  await f.actor.mutation(api.workspaces.index.leave, { workspaceId: f.workspaceId });
  expect((await f.actor.query(api.workspaces.index.list, {})).map((row) => row._id)).toEqual([other]);
  await f.t.run(async (ctx) => {
    expect(await ctx.db.get(f.projectId)).not.toBeNull();
    expect(
      (
        await ctx.db
          .query("projectMembers")
          .withIndex("by_project_user", (q) => q.eq("projectId", f.projectId).eq("userId", f.memberId))
          .unique()
      )?.active
    ).toBe(false);
  });
  expect((await f.actor.query(api.projects.index.list, { workspaceId: other }))[0]._id).toBe(otherProject);
  await expect(f.actor.mutation(api.workspaces.index.leave, { workspaceId: f.workspaceId })).rejects.toThrow("access");
});
test("final workspace and archived-project administrators cannot leave and failed cascades retain every membership", async () => {
  const f = await joiner();
  await expect(f.owner.mutation(api.workspaces.index.leave, { workspaceId: f.workspaceId })).rejects.toThrow(
    "workspace administrator"
  );
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: f.memberId,
    role: "admin",
  });
  await f.t.run((ctx) => ctx.db.patch(f.projectId, { archived: true }));
  await expect(f.owner.mutation(api.workspaces.index.leave, { workspaceId: f.workspaceId })).rejects.toThrow(
    "project administrator"
  );
  expect((await f.owner.query(api.workspaces.index.list, {}))[0]._id).toBe(f.workspaceId);
  await f.t.run(async (ctx) => {
    expect(
      (
        await ctx.db
          .query("projectMembers")
          .withIndex("by_project_user", (q) => q.eq("projectId", f.projectId).eq("userId", f.userId))
          .unique()
      )?.active
    ).toBe(true);
  });
});
test("guests can leave their own workspace but cannot leave another user's membership", async () => {
  const f = await joiner();
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: f.memberId,
    role: "guest",
  });
  await f.actor.mutation(api.workspaces.index.leave, { workspaceId: f.workspaceId });
  expect(await f.actor.query(api.workspaces.index.list, {})).toEqual([]);
  expect(await f.owner.query(api.workspaces.index.list, {})).toHaveLength(1);
});
test("overflow fails leave, admin revoke and guest demotion before any writes; inactive history does not consume budget", async () => {
  const f = await joiner();
  const ids = await f.t.run(async (ctx) => {
    const project = await ctx.db.get(f.projectId);
    if (!project) throw new Error("Missing fixture");
    const { _id, _creationTime, ...fields } = project;
    return Promise.all(
      Array.from({ length: MAX_ATOMIC_PROJECT_MEMBERSHIPS }, async (_, index) => {
        const projectId = await ctx.db.insert("projects", {
          ...fields,
          name: `Budget ${index}`,
          identifier: `B${index}`,
        });
        return ctx.db.insert("projectMembers", {
          workspaceId: f.workspaceId,
          projectId,
          userId: f.memberId,
          role: "member",
          active: true,
        });
      })
    );
  });
  await expect(f.actor.mutation(api.workspaces.index.leave, { workspaceId: f.workspaceId })).rejects.toThrow(
    "atomic budget"
  );
  await expect(
    f.owner.mutation(api.workspaces.index.revokeMember, { workspaceId: f.workspaceId, userId: f.memberId })
  ).rejects.toThrow("atomic budget");
  await expect(
    f.owner.mutation(api.workspaces.index.grantMember, {
      workspaceId: f.workspaceId,
      userId: f.memberId,
      role: "guest",
    })
  ).rejects.toThrow("atomic budget");
  expect((await f.actor.query(api.workspaces.index.list, {}))[0].membershipRole).toBe("member");
  await f.t.run(async (ctx) => {
    expect(
      await ctx.db
        .query("projectMembers")
        .withIndex("by_workspace_user_active", (q) =>
          q.eq("workspaceId", f.workspaceId).eq("userId", f.memberId).eq("active", true)
        )
        .collect()
    ).toHaveLength(MAX_ATOMIC_PROJECT_MEMBERSHIPS + 1);
    await ctx.db.patch(ids[0], { active: false });
  });
  await f.actor.mutation(api.workspaces.index.leave, { workspaceId: f.workspaceId });
  expect(await f.actor.query(api.workspaces.index.list, {})).toEqual([]);
});

test("concurrent administrator departures leave one current workspace and project administrator", async () => {
  const f = await joiner();
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: f.memberId,
    role: "admin",
  });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId: f.memberId, role: "admin" });
  const results = await Promise.allSettled([
    f.owner.mutation(api.workspaces.index.leave, { workspaceId: f.workspaceId }),
    f.actor.mutation(api.workspaces.index.leave, { workspaceId: f.workspaceId }),
  ]);
  expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(1);
  await f.t.run(async (ctx) => {
    expect(
      await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace_role_active", (q) =>
          q.eq("workspaceId", f.workspaceId).eq("role", "admin").eq("active", true)
        )
        .collect()
    ).toHaveLength(1);
    expect(
      await ctx.db
        .query("projectMembers")
        .withIndex("by_project_role_active", (q) =>
          q.eq("projectId", f.projectId).eq("role", "admin").eq("active", true)
        )
        .collect()
    ).toHaveLength(1);
  });
});
