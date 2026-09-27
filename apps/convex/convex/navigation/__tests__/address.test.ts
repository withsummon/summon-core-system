import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
const address = { workspaceSlug: "workspace", workItem: "DLV-1" };
async function fixture() {
  const f = await workspaceJourney();
  const taskId = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Private title" });
  return { ...f, taskId };
}
test("slug and case-insensitive identifier resolve canonical task and scope duplicate identifiers to workspace", async () => {
  const f = await fixture();
  expect(
    (await f.owner.query(api.navigation.address.resolveWorkspace, { workspaceSlug: "workspace" })).workspace._id
  ).toBe(f.workspaceId);
  expect(
    (
      await f.owner.query(api.navigation.address.resolveProject, {
        workspaceSlug: "workspace",
        projectIdentifier: "dlv",
      })
    ).project._id
  ).toBe(f.projectId);
  const first = await f.owner.query(api.navigation.address.resolveTask, { ...address, workItem: "dlv-001" });
  expect(first.task._id).toBe(f.taskId);
  expect(first.workItem).toBe("DLV-1");
  const workspaceId = await f.owner.mutation(api.workspaces.index.create, { name: "Other", slug: "other" });
  const projectId = await f.owner.mutation(api.projects.index.create, {
    workspaceId,
    name: "Other",
    identifier: "DLV",
  });
  const taskId = await f.owner.mutation(api.tasks.index.create, { projectId, title: "Other" });
  expect(
    (await f.owner.query(api.navigation.address.resolveTask, { ...address, workspaceSlug: "other" })).task._id
  ).toBe(taskId);
  expect((await f.owner.query(api.navigation.address.resolveTask, address)).task._id).toBe(f.taskId);
});
test("anonymous and workspace admin without project membership cannot resolve private task", async () => {
  const f = await fixture();
  await expect(f.t.query(api.navigation.address.resolveTask, address)).rejects.toThrow("Sign in");
  const userId = await f.t.run((ctx) => ctx.db.insert("users", {}));
  const outsider = f.t.withIdentity({ subject: userId });
  await expect(outsider.query(api.navigation.address.resolveTask, address)).rejects.toThrow("workspace");
  await f.t.run((ctx) =>
    ctx.db.insert("workspaceMembers", { workspaceId: f.workspaceId, userId, role: "admin", active: true })
  );
  await expect(outsider.query(api.navigation.address.resolveTask, address)).rejects.toThrow("project");
});
test("guest ownership, guest feature flag and revoked project membership use canonical task ACL", async () => {
  const f = await fixture();
  const guestId = await f.t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {});
    await ctx.db.insert("workspaceMembers", { workspaceId: f.workspaceId, userId, role: "guest", active: true });
    await ctx.db.insert("projectMembers", {
      workspaceId: f.workspaceId,
      projectId: f.projectId,
      userId,
      role: "guest",
      active: true,
    });
    return userId;
  });
  const guest = f.t.withIdentity({ subject: guestId });
  await expect(guest.query(api.navigation.address.resolveTask, address)).rejects.toThrow("Task not found");
  await f.t.run((ctx) => ctx.db.patch(f.taskId, { createdBy: guestId }));
  expect((await guest.query(api.navigation.address.resolveTask, address)).task.canEdit).toBe(false);
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.taskId, { createdBy: f.userId });
    await ctx.db.patch(f.projectId, { guestViewAllFeatures: true });
  });
  expect((await guest.query(api.navigation.address.resolveTask, address)).task._id).toBe(f.taskId);
  await f.owner.mutation(api.projects.index.revokeMember, { projectId: f.projectId, userId: guestId });
  await expect(guest.query(api.navigation.address.resolveTask, address)).rejects.toThrow("project");
});
test("archived task reads remain authorized while trash, triage and archived projects stay hidden", async () => {
  const f = await fixture();
  await f.t.run((ctx) => ctx.db.patch(f.taskId, { archivedAt: Date.now() }));
  expect((await f.owner.query(api.navigation.address.resolveTask, address)).task.canEdit).toBe(false);
  await f.t.run((ctx) => ctx.db.patch(f.taskId, { deletedAt: Date.now() }));
  await expect(f.owner.query(api.navigation.address.resolveTask, address)).rejects.toThrow("Task not found");
  await f.t.run((ctx) => ctx.db.patch(f.taskId, { deletedAt: null, archivedAt: null, status: "triage" }));
  await expect(f.owner.query(api.navigation.address.resolveTask, address)).rejects.toThrow("Task not found");
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.taskId, { status: "todo" });
    await ctx.db.patch(f.projectId, { archived: true });
  });
  await expect(f.owner.query(api.navigation.address.resolveTask, address)).rejects.toThrow("Project not found");
});
test.each([
  "https://external.test/DLV-1",
  "DLV-1-extra",
  "DLV-0",
  "DLV--1",
  "DLV-1.5",
  "DLV-9007199254740992",
  "DLV-١",
  " DLV-1",
])("rejects invalid address %s", async (workItem) => {
  const f = await fixture();
  await expect(f.owner.query(api.navigation.address.resolveTask, { ...address, workItem })).rejects.toThrow(
    "Invalid task address"
  );
});
