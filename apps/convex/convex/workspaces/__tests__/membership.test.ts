import { describe, expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";

describe("workspace membership administration", () => {
  test("only administrators resolve explicit user IDs, without email matching or private profile fields", async () => {
    const { t, owner, workspaceId } = await workspaceJourney();
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", { name: "Colleague", email: "colleague@example.test", phone: "private" })
    );
    const colleague = t.withIdentity({ subject: userId });
    expect(await owner.query(api.workspaces.index.resolveMember, { workspaceId, userId })).toEqual({
      id: userId,
      name: "Colleague",
      email: "colleague@example.test",
    });
    await expect(
      owner.query(api.workspaces.index.resolveMember, { workspaceId, userId: "colleague@example.test" })
    ).rejects.toThrow("User not found");
    await expect(owner.query(api.workspaces.index.resolveMember, { workspaceId, userId: workspaceId })).rejects.toThrow(
      "User not found"
    );
    await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "member" });
    await expect(colleague.query(api.workspaces.index.resolveMember, { workspaceId, userId })).rejects.toThrow(
      "administrators"
    );
    await expect(t.query(api.workspaces.index.resolveMember, { workspaceId, userId })).rejects.toThrow("Sign in");
  });

  test("given an administrator, an explicit user grant is idempotent and grants workspace visibility", async () => {
    const { t, owner, workspaceId } = await workspaceJourney();
    const userId = await t.run((ctx) => ctx.db.insert("users", { name: "Colleague" }));
    const colleague = t.withIdentity({ subject: userId });
    expect(await colleague.query(api.workspaces.index.list, {})).toEqual([]);
    const membershipId = await owner.mutation(api.workspaces.index.grantMember, {
      workspaceId,
      userId,
      role: "member",
    });
    expect(await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "member" })).toBe(
      membershipId
    );
    expect(await colleague.query(api.workspaces.index.list, {})).toMatchObject([
      { _id: workspaceId, membershipRole: "member" },
    ]);
    await expect(
      colleague.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "admin" })
    ).rejects.toThrow("administrators");
    await expect(colleague.mutation(api.workspaces.index.revokeMember, { workspaceId, userId })).rejects.toThrow(
      "administrators"
    );
  });

  test("given another workspace's administrator, member management is denied", async () => {
    const { t, owner, workspaceId, userId } = await workspaceJourney();
    const otherId = await t.run((ctx) => ctx.db.insert("users", { name: "Outsider" }));
    const outsider = t.withIdentity({ subject: otherId });
    await outsider.mutation(api.workspaces.index.create, { name: "Other", slug: "other" });
    await expect(
      outsider.mutation(api.workspaces.index.grantMember, { workspaceId, userId: otherId, role: "admin" })
    ).rejects.toThrow("access");
    await expect(outsider.mutation(api.workspaces.index.revokeMember, { workspaceId, userId })).rejects.toThrow(
      "access"
    );
    expect(await owner.query(api.workspaces.index.list, {})).toHaveLength(1);
  });

  test("given workspace revocation, project access does not resurrect when workspace access is later restored", async () => {
    const { t, owner, workspaceId, projectId } = await workspaceJourney();
    const userId = await t.run((ctx) => ctx.db.insert("users", { name: "Colleague" }));
    const colleague = t.withIdentity({ subject: userId });
    await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "member" });
    await owner.mutation(api.projects.index.grantMember, { projectId, userId, role: "member" });
    await colleague.mutation(api.tasks.index.create, { projectId, title: "Work" });
    await owner.mutation(api.workspaces.index.revokeMember, { workspaceId, userId });
    await owner.mutation(api.workspaces.index.revokeMember, { workspaceId, userId });
    expect(await colleague.query(api.workspaces.index.list, {})).toEqual([]);
    await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "member" });
    expect(await colleague.query(api.projects.index.list, { workspaceId })).toEqual([]);
    await expect(colleague.mutation(api.tasks.index.create, { projectId, title: "Denied" })).rejects.toThrow("access");
    await owner.mutation(api.projects.index.grantMember, { projectId, userId, role: "member" });
    expect(await colleague.query(api.projects.index.list, { workspaceId })).toHaveLength(1);
  });

  test("given guest demotion, project write grants become guest grants and cannot silently regain write access", async () => {
    const { t, owner, workspaceId, projectId } = await workspaceJourney();
    const userId = await t.run((ctx) => ctx.db.insert("users", { name: "Colleague" }));
    const colleague = t.withIdentity({ subject: userId });
    await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "member" });
    await owner.mutation(api.projects.index.grantMember, { projectId, userId, role: "admin" });
    await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "guest" });
    await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "member" });
    await expect(colleague.mutation(api.tasks.index.create, { projectId, title: "Denied" })).rejects.toThrow("access");
    expect(await colleague.query(api.projects.index.list, { workspaceId })).toHaveLength(1);
  });

  test("given the last workspace administrator, self-revocation and demotion are rejected", async () => {
    const { owner, workspaceId, userId } = await workspaceJourney();
    await expect(owner.mutation(api.workspaces.index.revokeMember, { workspaceId, userId })).rejects.toThrow(
      "another workspace administrator"
    );
    await expect(
      owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "member" })
    ).rejects.toThrow("another workspace administrator");
  });

  test("given a sole project administrator, workspace removal requires a project-admin handoff and rolls back earlier changes", async () => {
    const { t, owner, workspaceId, projectId, userId: ownerId } = await workspaceJourney();
    const userId = await t.run((ctx) => ctx.db.insert("users", { name: "Colleague" }));
    const colleague = t.withIdentity({ subject: userId });
    await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "admin" });
    await owner.mutation(api.projects.index.grantMember, { projectId, userId, role: "member" });
    const ownProjectId = await colleague.mutation(api.projects.index.create, {
      workspaceId,
      name: "Private",
      identifier: "PVT",
    });
    await expect(owner.mutation(api.workspaces.index.revokeMember, { workspaceId, userId })).rejects.toThrow(
      "another project administrator"
    );
    expect(await colleague.query(api.projects.index.list, { workspaceId })).toHaveLength(2);
    await expect(
      owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "guest" })
    ).rejects.toThrow("another project administrator");
    await colleague.mutation(api.projects.index.grantMember, {
      projectId: ownProjectId,
      userId: ownerId,
      role: "admin",
    });
    await owner.mutation(api.workspaces.index.revokeMember, { workspaceId, userId });
    expect(await colleague.query(api.workspaces.index.list, {})).toEqual([]);
  });
});

test("given two workspace administrators demoting themselves concurrently, one administrator remains", async () => {
  const { t, owner, workspaceId, userId: ownerId } = await workspaceJourney();
  const userId = await t.run((ctx) => ctx.db.insert("users", { name: "Other admin" }));
  await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "admin" });
  const other = t.withIdentity({ subject: userId });
  const results = await Promise.allSettled([
    owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId: ownerId, role: "member" }),
    other.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "member" }),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  const admins = await t.run((ctx) =>
    ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_role_active", (q) =>
        q.eq("workspaceId", workspaceId).eq("role", "admin").eq("active", true)
      )
      .collect()
  );
  expect(admins).toHaveLength(1);
});
