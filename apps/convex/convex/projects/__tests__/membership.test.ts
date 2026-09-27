import { signedIn } from "../../../test-support/session";
import { describe, expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";

describe("project membership administration", () => {
  test("project administrators resolve only active workspace members", async () => {
    const { t, owner, workspaceId, projectId } = await workspaceJourney();
    const userId = await t.run((ctx) => ctx.db.insert("users", { name: "Colleague" }));
    const colleague = await signedIn(t, userId);
    await expect(owner.query(api.projects.index.resolveMember, { projectId, userId })).rejects.toThrow("active member");
    await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "member" });
    expect(await owner.query(api.projects.index.resolveMember, { projectId, userId })).toEqual({
      id: userId,
      name: "Colleague",
      email: null,
    });
    await expect(owner.query(api.projects.index.resolveMember, { projectId, userId: "invalid" })).rejects.toThrow(
      "User not found"
    );
    await owner.mutation(api.projects.index.grantMember, { projectId, userId, role: "member" });
    await expect(colleague.query(api.projects.index.resolveMember, { projectId, userId })).rejects.toThrow(
      "administrators"
    );
    await owner.mutation(api.projects.index.grantMember, { projectId, userId, role: "admin" });
    expect(await colleague.query(api.projects.index.resolveMember, { projectId, userId })).toMatchObject({
      id: userId,
    });
  });

  test("given a workspace writer, project grant enables collaboration and revocation immediately denies it", async () => {
    const { t, owner, workspaceId, projectId } = await workspaceJourney();
    const userId = await t.run((ctx) => ctx.db.insert("users", { name: "Colleague" }));
    const colleague = await signedIn(t, userId);
    await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "member" });
    const membershipId = await owner.mutation(api.projects.index.grantMember, { projectId, userId, role: "member" });
    expect(await owner.mutation(api.projects.index.grantMember, { projectId, userId, role: "member" })).toBe(
      membershipId
    );
    const taskId = await colleague.mutation(api.tasks.index.create, { projectId, title: "Shared work" });
    await owner.mutation(api.tasks.index.setStatus, { taskId, status: "done" });
    const page = await colleague.query(api.tasks.index.list, {
      projectId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page.page).toMatchObject([{ _id: taskId, status: "done" }]);
    await owner.mutation(api.projects.index.revokeMember, { projectId, userId });
    await owner.mutation(api.projects.index.revokeMember, { projectId, userId });
    await expect(
      colleague.query(api.tasks.index.list, { projectId, paginationOpts: { numItems: 10, cursor: null } })
    ).rejects.toThrow("access");
    await expect(colleague.mutation(api.tasks.index.setStatus, { taskId, status: "todo" })).rejects.toThrow("access");
  });

  test("given a member of another workspace or an inactive workspace member, a project grant is rejected", async () => {
    const { t, owner, workspaceId, projectId } = await workspaceJourney();
    const userId = await t.run((ctx) => ctx.db.insert("users", { name: "Other" }));
    const outsider = await signedIn(t, userId);
    await outsider.mutation(api.workspaces.index.create, { name: "Other", slug: "other" });
    await expect(owner.mutation(api.projects.index.grantMember, { projectId, userId, role: "member" })).rejects.toThrow(
      "active member of this workspace"
    );
    await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "member" });
    await owner.mutation(api.workspaces.index.revokeMember, { workspaceId, userId });
    await expect(owner.mutation(api.projects.index.grantMember, { projectId, userId, role: "member" })).rejects.toThrow(
      "active member of this workspace"
    );
  });

  test("given a workspace guest, only guest project access can be granted", async () => {
    const { t, owner, workspaceId, projectId } = await workspaceJourney();
    const userId = await t.run((ctx) => ctx.db.insert("users", { name: "Guest" }));
    const guest = await signedIn(t, userId);
    await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "guest" });
    await expect(owner.mutation(api.projects.index.grantMember, { projectId, userId, role: "admin" })).rejects.toThrow(
      "only receive guest"
    );
    await owner.mutation(api.projects.index.grantMember, { projectId, userId, role: "guest" });
    expect(await guest.query(api.projects.index.list, { workspaceId })).toMatchObject([
      { _id: projectId, membershipRole: "guest", workspaceRole: "guest" },
    ]);
    await expect(guest.mutation(api.tasks.index.create, { projectId, title: "Denied" })).rejects.toThrow("access");
  });

  test("given a project member or a workspace admin without project membership, management is denied", async () => {
    const { t, owner, workspaceId, projectId, userId: ownerId } = await workspaceJourney();
    const userId = await t.run((ctx) => ctx.db.insert("users", { name: "Member" }));
    const member = await signedIn(t, userId);
    await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "admin" });
    await expect(member.mutation(api.projects.index.grantMember, { projectId, userId, role: "admin" })).rejects.toThrow(
      "access"
    );
    await owner.mutation(api.projects.index.grantMember, { projectId, userId, role: "member" });
    await expect(member.mutation(api.projects.index.grantMember, { projectId, userId, role: "admin" })).rejects.toThrow(
      "project administrators"
    );
    await expect(member.mutation(api.projects.index.revokeMember, { projectId, userId: ownerId })).rejects.toThrow(
      "project administrators"
    );
  });

  test("given the last project administrator, ownership must be handed off before revocation or demotion", async () => {
    const { t, owner, workspaceId, projectId, userId: ownerId } = await workspaceJourney();
    await expect(owner.mutation(api.projects.index.revokeMember, { projectId, userId: ownerId })).rejects.toThrow(
      "another project administrator"
    );
    await expect(
      owner.mutation(api.projects.index.grantMember, { projectId, userId: ownerId, role: "member" })
    ).rejects.toThrow("another project administrator");
    const userId = await t.run((ctx) => ctx.db.insert("users", { name: "Successor" }));
    await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "member" });
    await owner.mutation(api.projects.index.grantMember, { projectId, userId, role: "admin" });
    await owner.mutation(api.projects.index.revokeMember, { projectId, userId: ownerId });
    const successor = await signedIn(t, userId);
    expect(await successor.mutation(api.tasks.index.create, { projectId, title: "Continued delivery" })).toBeTruthy();
  });
});
