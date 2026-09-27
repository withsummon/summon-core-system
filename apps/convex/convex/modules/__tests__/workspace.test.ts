import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
const fields = {
  name: "Workspace module",
  descriptionHtml: "",
  startDate: null,
  targetDate: null,
  status: "backlog" as const,
  leadId: null,
};
const paginationOpts = { cursor: null, numItems: 10 };
test("workspace module directory excludes removed and archived modules/projects and returns canonical project identity", async () => {
  const f = await workspaceJourney();
  const visible = await f.owner.mutation(api.modules.index.create, { projectId: f.projectId, ...fields });
  const archived = await f.owner.mutation(api.modules.index.create, {
    projectId: f.projectId,
    ...fields,
    name: "Archived module",
  });
  const deleted = await f.owner.mutation(api.modules.index.create, {
    projectId: f.projectId,
    ...fields,
    name: "Removed module",
  });
  const otherProject = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Archived",
    identifier: "ARC",
  });
  await f.owner.mutation(api.modules.index.create, { projectId: otherProject, ...fields });
  await f.t.run(async (ctx) => {
    await ctx.db.patch(archived, { archived: true });
    await ctx.db.patch(deleted, { deleted: true });
    await ctx.db.patch(otherProject, { archived: true });
  });
  const result = await f.owner.query(api.modules.workspace.list, { workspaceId: f.workspaceId, paginationOpts });
  expect(result.page.map((row) => row.module._id)).toEqual([visible]);
  expect(result.page[0].project).toEqual({ id: f.projectId, name: "Delivery", identifier: "DLV" });
});
test("sparse workspace module pages retain continuation and recheck project access without enumerating projects", async () => {
  const f = await workspaceJourney();
  const readable = await f.owner.mutation(api.modules.index.create, { projectId: f.projectId, ...fields });
  const privateProject = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Private",
    identifier: "PRI",
  });
  await f.owner.mutation(api.modules.index.create, { projectId: privateProject, ...fields });
  const userId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Reader" }));
  const reader = await signedIn(f.t, userId);
  const membershipId = await f.t.run(async (ctx) => {
    await ctx.db.insert("workspaceMembers", { workspaceId: f.workspaceId, userId, role: "guest", active: true });
    return ctx.db.insert("projectMembers", {
      workspaceId: f.workspaceId,
      projectId: f.projectId,
      userId,
      role: "guest",
      active: true,
    });
  });
  const first = await reader.query(api.modules.workspace.list, {
    workspaceId: f.workspaceId,
    paginationOpts: { cursor: null, numItems: 1 },
  });
  expect(first.page).toEqual([]);
  expect(first.isDone).toBe(false);
  const second = await reader.query(api.modules.workspace.list, {
    workspaceId: f.workspaceId,
    paginationOpts: { cursor: first.continueCursor, numItems: 1 },
  });
  expect(second.page.map((row) => row.module._id)).toEqual([readable]);
  await f.t.run((ctx) => ctx.db.patch(membershipId, { active: false }));
  expect((await reader.query(api.modules.workspace.list, { workspaceId: f.workspaceId, paginationOpts })).page).toEqual(
    []
  );
});
test("workspace module directory rejects foreign workspace access and excessive page sizes", async () => {
  const f = await workspaceJourney();
  const userId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Outsider" }));
  const outsider = await signedIn(f.t, userId);
  await expect(
    outsider.query(api.modules.workspace.list, { workspaceId: f.workspaceId, paginationOpts })
  ).rejects.toThrow("access");
  await expect(
    f.owner.query(api.modules.workspace.list, {
      workspaceId: f.workspaceId,
      paginationOpts: { cursor: null, numItems: 101 },
    })
  ).rejects.toThrow();
});
