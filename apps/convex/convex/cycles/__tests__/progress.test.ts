import { expect, test } from "vitest";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
async function fixture(count = 1) {
  const f = await workspaceJourney();
  const cycleId = await f.owner.mutation(api.cycles.index.create, {
    projectId: f.projectId,
    name: "Progress",
    description: "",
    startDate: null,
    endDate: null,
  });
  const taskIds = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: `Task ${i}` })
    )
  );
  await f.t.run(async (ctx) => {
    await Promise.all(taskIds.map((taskId) => ctx.db.insert("cycleTasks", { cycleId, taskId })));
  });
  return { ...f, cycleId, taskIds };
}
test("current progress traverses more than 100 memberships with bounded contributions and current status", async () => {
  const f = await fixture(101);
  let cursor: string | null = null;
  let count = 0,
    pages = 0;
  do {
    // Each request consumes the cursor returned by the previous page.
    // oxlint-disable-next-line no-await-in-loop
    const result: FunctionReturnType<typeof api.cycles.progress.page> = await f.owner.query(api.cycles.progress.page, {
      cycleId: f.cycleId,
      paginationOpts: { numItems: 20, cursor },
    });
    expect(result.page).toHaveLength(1);
    expect(result.page[0].count).toBeLessThanOrEqual(20);
    count += result.page[0].count;
    pages++;
    cursor = result.isDone ? null : result.continueCursor;
  } while (cursor);
  expect(count).toBe(101);
  expect(pages).toBe(6);
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskIds[0], status: "done" });
  const current = await f.owner.query(api.cycles.progress.page, {
    cycleId: f.cycleId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(current.page[0].statuses.find((row) => row.id === "done")?.count).toBe(1);
  await expect(
    f.owner.query(api.cycles.progress.page, { cycleId: f.cycleId, paginationOpts: { numItems: 21, cursor: null } })
  ).rejects.toThrow("1–20");
});
test("guest sparse pages hide other creators and revoked membership denies progress", async () => {
  const f = await fixture(2);
  const userId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Guest" }));
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role: "guest" });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId, role: "guest" });
  await f.t.run((ctx) => ctx.db.patch(f.taskIds[1], { createdBy: userId }));
  const guest = await signedIn(f.t, userId);
  const first = await guest.query(api.cycles.progress.page, {
    cycleId: f.cycleId,
    paginationOpts: { numItems: 1, cursor: null },
  });
  expect(first.page[0].count).toBe(0);
  expect(first.isDone).toBe(false);
  const second = await guest.query(api.cycles.progress.page, {
    cycleId: f.cycleId,
    paginationOpts: { numItems: 1, cursor: first.continueCursor },
  });
  expect(second.page[0].count).toBe(1);
  await f.owner.mutation(api.projects.index.revokeMember, { projectId: f.projectId, userId });
  await expect(
    guest.query(api.cycles.progress.page, { cycleId: f.cycleId, paginationOpts: { numItems: 20, cursor: null } })
  ).rejects.toThrow();
});
test("inactive and foreign membership records do not contribute; cycle trash is unavailable", async () => {
  const f = await fixture(4);
  const otherProject = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Other",
    identifier: "OTHER",
  });
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.taskIds[0], { archivedAt: 1 });
    await ctx.db.patch(f.taskIds[1], { deletedAt: 1 });
    await ctx.db.patch(f.taskIds[2], { status: "triage" });
    await ctx.db.patch(f.taskIds[3], { projectId: otherProject });
  });
  const result = await f.owner.query(api.cycles.progress.page, {
    cycleId: f.cycleId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(result.page[0]).toMatchObject({
    count: 0,
    numericEstimates: 0,
    unquantifiedEstimates: 0,
    statuses: [],
    labels: [],
    assignees: [],
  });
  await f.t.run((ctx) => ctx.db.patch(f.cycleId, { deleted: true }));
  await expect(
    f.owner.query(api.cycles.progress.page, { cycleId: f.cycleId, paginationOpts: { numItems: 20, cursor: null } })
  ).rejects.toThrow("not found");
});
test("current distributions share numeric estimate semantics without exposing foreign label names", async () => {
  const f = await fixture(3);
  const other = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Other",
    identifier: "OTHER",
  });
  const labelId = await f.owner.mutation(api.tasks.labels.save, {
    projectId: other,
    parentId: null,
    data: { name: "Private foreign label", description: "", color: "", sortOrder: 0 },
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
      value: "3.5",
      description: "",
      revision: 0,
      deleted: false,
      retiring: false,
    });
    const categorySystemId = await ctx.db.insert("estimateSystems", {
      projectId: f.projectId,
      workspaceId: f.workspaceId,
      name: "Sizes",
      description: "",
      type: "categories",
      revision: 0,
      deleted: false,
      retiring: false,
    });
    const category = await ctx.db.insert("estimatePoints", {
      projectId: f.projectId,
      systemId: categorySystemId,
      key: 1,
      value: "Large",
      description: "",
      revision: 0,
      deleted: false,
      retiring: false,
    });
    const foreignPoint = await ctx.db.insert("estimatePoints", {
      projectId: other,
      systemId,
      key: 2,
      value: "999",
      description: "",
      revision: 0,
      deleted: false,
      retiring: false,
    });
    await ctx.db.patch(f.taskIds[2], { estimatePointId: foreignPoint });
    await ctx.db.patch(f.userId, { name: "", email: "owner@example.test" });
    await ctx.db.patch(f.taskIds[0], {
      estimatePointId: pointId,
      assigneeIds: [f.userId],
      labelIds: [labelId],
      status: "done",
    });
    await ctx.db.patch(f.taskIds[1], { estimatePointId: category });
  });
  const {
    page: [summary],
  } = await f.owner.query(api.cycles.progress.page, {
    cycleId: f.cycleId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(summary).toMatchObject({ count: 3, numericEstimates: 3.5, unquantifiedEstimates: 2 });
  expect(summary.statuses.find((row) => row.id === "done")).toMatchObject({ count: 1, numericEstimates: 3.5 });
  expect(summary.assignees.find((row) => row.id === f.userId)?.name).toBe("owner@example.test");
  expect(summary.labels.find((row) => row.id === labelId)?.name).toBe("Unavailable label");
  expect(JSON.stringify(summary)).not.toContain("Private foreign label");
});
