import { signedIn } from "../../../test-support/session";
import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { curve } from "../completion_curve";
import { snapshot } from "../transfer_snapshot";
import { cycleDay } from "../dates";

test("current completion curve retains pre-start completions and reflects reopening without inventing history", async () => {
  const f = await workspaceJourney();
  const cycleId = await f.owner.mutation(api.cycles.index.create, {
    projectId: f.projectId,
    name: "Curve",
    description: "",
    startDate: null,
    endDate: null,
  });
  const taskId = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Completed" });
  await f.t.run(async (ctx) => {
    await ctx.db.patch(cycleId, { startDate: "2026-09-26", endDate: "2026-09-30", timezone: "Asia/Jakarta" });
    await ctx.db.patch(taskId, { status: "done", completedAt: Date.parse("2026-09-24T18:00:00Z") });
  });
  const frozen = await f.t.run(async (ctx) => {
    const cycle = await ctx.db.get(cycleId),
      task = await ctx.db.get(taskId);
    if (!cycle || !task) throw new Error("Missing fixture");
    const current = await curve(ctx, cycle, [task], Date.parse("2026-09-27T18:00:00Z"));
    expect(current.asOfDay).toBe("2026-09-28");
    expect(current.completed).toEqual([{ day: "2026-09-25", count: 1, points: 0, unquantified: 0 }]);
    return snapshot(ctx, [task], cycle);
  });
  await f.owner.mutation(api.tasks.index.setStatus, { taskId, status: "todo" });
  await f.t.run(async (ctx) => {
    const cycle = await ctx.db.get(cycleId),
      task = await ctx.db.get(taskId);
    if (!cycle || !task) throw new Error("Missing fixture");
    expect((await curve(ctx, cycle, [task], Date.now())).completed).toEqual([]);
  });
  expect(frozen.completionCurve.completed).toHaveLength(1);
});
test("calendar day conversion uses the cycle timezone across DST and UTC midnight", () => {
  expect(cycleDay("America/New_York", Date.parse("2026-03-08T06:59:00Z"))).toBe("2026-03-08");
  expect(cycleDay("America/New_York", Date.parse("2026-03-08T07:01:00Z"))).toBe("2026-03-08");
  expect(cycleDay("America/New_York", Date.parse("2026-09-28T00:01:00Z"))).toBe("2026-09-27");
});

test("bounded contributions retain sparse guest cursors and old frozen curves are explicitly unavailable", async () => {
  const f = await workspaceJourney();
  const cycleId = await f.owner.mutation(api.cycles.index.create, {
    projectId: f.projectId,
    name: "Pages",
    description: "",
    startDate: null,
    endDate: null,
  });
  const taskId = await f.owner.mutation(api.tasks.index.create, {
    projectId: f.projectId,
    title: "Private to writers",
  });
  const guestId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Guest" }));
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: guestId,
    role: "guest",
  });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId: guestId, role: "guest" });
  await f.t.run((ctx) => ctx.db.insert("cycleTasks", { cycleId, taskId }));
  const guest = await signedIn(f.t, guestId);
  const args = { cycleId, now: Date.now(), paginationOpts: { cursor: null, numItems: 1 } };
  expect((await guest.query(api.cycles.burndown.page, args)).page[0].count).toBe(0);
  expect((await f.owner.query(api.cycles.burndown.page, args)).page[0].count).toBe(1);
  const transferId = await f.t.run((ctx) =>
    ctx.db.insert("cycleTransfers", {
      sourceId: cycleId,
      destinationId: cycleId,
      projectId: f.projectId,
      actorId: f.userId,
      status: "completed",
      revision: 0,
      entries: [],
      snapshot: {
        count: 1,
        numericEstimates: 0,
        unquantifiedEstimates: 0,
        statuses: [],
        assignees: [],
        labels: [],
        capturedAt: 1,
      },
    })
  );
  expect(await f.owner.query(api.cycles.burndown.frozen, { transferId })).toEqual({
    status: "unavailable",
    curve: null,
  });
  await expect(guest.query(api.cycles.burndown.frozen, { transferId })).rejects.toThrow();
  await f.t.run(async (ctx) => {
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", f.projectId).eq("userId", guestId))
      .unique();
    if (!membership) throw new Error("Missing fixture");
    await ctx.db.patch(membership._id, { active: false });
  });
  await expect(guest.query(api.cycles.burndown.page, args)).rejects.toThrow();
});

test("current numeric estimates change the curve but not its captured transfer value", async () => {
  const f = await workspaceJourney();
  const cycleId = await f.owner.mutation(api.cycles.index.create, {
    projectId: f.projectId,
    name: "Points",
    description: "",
    startDate: null,
    endDate: null,
  });
  const taskId = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Estimate" });
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
      key: 0,
      value: "2.5",
      description: "",
      revision: 0,
      deleted: false,
      retiring: false,
    });
    await ctx.db.patch(taskId, { estimatePointId: pointId, completedAt: 1000, status: "done" });
    const cycle = await ctx.db.get(cycleId),
      task = await ctx.db.get(taskId);
    if (!cycle || !task) throw new Error("Missing fixture");
    const captured = await curve(ctx, cycle, [task], 2000);
    expect(captured.points).toBe(2.5);
    await ctx.db.patch(pointId, { value: "5" });
    expect((await curve(ctx, cycle, [task], 2000)).points).toBe(5);
    expect(captured.points).toBe(2.5);
    await ctx.db.patch(systemId, { type: "categories" });
    const category = await curve(ctx, cycle, [task], 2000);
    expect(category.points).toBe(0);
    expect(category.unquantified).toBe(1);
  });
});
