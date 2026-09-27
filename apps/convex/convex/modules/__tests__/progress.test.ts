import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
async function fixture(count = 2) {
  const f = await workspaceJourney();
  const create = (name: string) =>
    f.owner.mutation(api.modules.index.create, {
      projectId: f.projectId,
      name,
      descriptionHtml: "<p></p>",
      startDate: null,
      targetDate: null,
      status: "planned",
      leadId: null,
    });
  const moduleId = await create("Delivery"),
    otherModuleId = await create("Other");
  const taskIds = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: `Task ${i}` })
    )
  );
  await f.t.run(async (ctx) => {
    await Promise.all(taskIds.map((taskId) => ctx.db.insert("moduleTasks", { moduleId, taskId })));
    await ctx.db.insert("moduleTasks", { moduleId: otherModuleId, taskId: taskIds[0] });
  });
  return { ...f, moduleId, otherModuleId, taskIds };
}
test("bounded module progress preserves many-to-many membership and sparse continuation", async () => {
  const f = await fixture(23);
  await f.t.run(async (ctx) => {
    await Promise.all(f.taskIds.map((taskId) => ctx.db.patch(taskId, { archivedAt: 1 })));
  });
  const first = await f.owner.query(api.modules.progress.page, {
    moduleId: f.moduleId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(first.isDone).toBe(false);
  expect(first.page[0].count).toBe(0);
  const second = await f.owner.query(api.modules.progress.page, {
    moduleId: f.moduleId,
    paginationOpts: { numItems: 20, cursor: first.continueCursor },
  });
  expect(second.isDone).toBe(true);
  expect(second.page[0].count).toBe(0);
  await f.t.run((ctx) => ctx.db.patch(f.taskIds[0], { archivedAt: null }));
  for (const moduleId of [f.moduleId, f.otherModuleId]) {
    // Each module is an independently owned membership collection.
    // oxlint-disable-next-line no-await-in-loop
    const result = await f.owner.query(api.modules.progress.page, {
      moduleId,
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(result.page[0].count).toBe(1);
  }
  expect(await f.t.run((ctx) => ctx.db.query("moduleTasks").collect())).toHaveLength(24);
});
test("completed and pending distributions follow completedAt; cancelled tasks remain pending", async () => {
  const f = await fixture(3);
  const labelId = await f.owner.mutation(api.tasks.labels.save, {
    projectId: f.projectId,
    parentId: null,
    data: { name: "Delivery", description: "", color: "", sortOrder: 0 },
  });
  await f.t.run(async (ctx) => {
    const systemId = await ctx.db.insert("estimateSystems", {
      projectId: f.projectId,
      workspaceId: f.workspaceId,
      name: "Points",
      description: "",
      type: "points",
      revision: 0,
      deleted: false,
      retiring: false,
    });
    const pointId = await ctx.db.insert("estimatePoints", {
      projectId: f.projectId,
      systemId,
      key: 1,
      value: "2.5",
      description: "",
      revision: 0,
      deleted: false,
      retiring: false,
    });
    await Promise.all(
      f.taskIds.map((taskId) =>
        ctx.db.patch(taskId, { estimatePointId: pointId, assigneeIds: [f.userId], labelIds: [labelId] })
      )
    );
  });
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskIds[0], status: "done" });
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskIds[1], status: "cancelled" });
  const {
    page: [summary],
  } = await f.owner.query(api.modules.progress.page, {
    moduleId: f.moduleId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(summary).toMatchObject({
    count: 3,
    numericEstimates: 7.5,
    completed: { count: 1, numericEstimates: 2.5 },
    pending: { count: 2, numericEstimates: 5 },
  });
  for (const row of [summary.assignees[0], summary.labels[0]])
    expect(row).toMatchObject({
      count: 3,
      completed: { count: 1, numericEstimates: 2.5 },
      pending: { count: 2, numericEstimates: 5 },
    });
  expect(summary.statuses.find((row) => row.id === "cancelled")?.pending.count).toBe(1);
});
test("analytics requires current writer membership, but archived modules remain readable", async () => {
  const f = await fixture();
  const userId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Guest" }));
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role: "guest" });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId, role: "guest" });
  const guest = await signedIn(f.t, userId);
  await expect(
    guest.query(api.modules.progress.page, { moduleId: f.moduleId, paginationOpts: { numItems: 20, cursor: null } })
  ).rejects.toThrow();
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role: "member" });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId, role: "member" });
  await f.t.run((ctx) => ctx.db.patch(f.moduleId, { archived: true }));
  expect(
    (
      await guest.query(api.modules.progress.page, {
        moduleId: f.moduleId,
        paginationOpts: { numItems: 20, cursor: null },
      })
    ).page[0].count
  ).toBe(2);
  await f.owner.mutation(api.projects.index.revokeMember, { projectId: f.projectId, userId });
  await expect(
    guest.query(api.modules.progress.page, { moduleId: f.moduleId, paginationOpts: { numItems: 20, cursor: null } })
  ).rejects.toThrow();
});
test("foreign records and trash do not leak task progress", async () => {
  const f = await fixture();
  const other = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Foreign",
    identifier: "FRN",
  });
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.taskIds[0], { projectId: other });
    await ctx.db.patch(f.taskIds[1], { deletedAt: 1 });
  });
  expect(
    (
      await f.owner.query(api.modules.progress.page, {
        moduleId: f.moduleId,
        paginationOpts: { numItems: 20, cursor: null },
      })
    ).page[0].count
  ).toBe(0);
  await f.t.run((ctx) => ctx.db.patch(f.moduleId, { deleted: true }));
  await expect(
    f.owner.query(api.modules.progress.page, { moduleId: f.moduleId, paginationOpts: { numItems: 20, cursor: null } })
  ).rejects.toThrow("not found");
});
