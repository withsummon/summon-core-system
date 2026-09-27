import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
async function fixture(count = 2) {
  const f = await workspaceJourney();
  const sourceId = await f.owner.mutation(api.cycles.index.create, {
    projectId: f.projectId,
    name: "Source",
    description: "",
    startDate: null,
    endDate: null,
  });
  const destinationId = await f.owner.mutation(api.cycles.index.create, {
    projectId: f.projectId,
    name: "Destination",
    description: "",
    startDate: null,
    endDate: null,
  });
  const taskIds = await Promise.all(
    Array.from({ length: count }, (_, index) =>
      f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: `Task ${index}` })
    )
  );
  await f.t.run(async (ctx) => {
    await Promise.all(taskIds.map((taskId) => ctx.db.insert("cycleTasks", { taskId, cycleId: sourceId })));
    await ctx.db.patch(sourceId, { startDate: "2020-01-01", endDate: "2020-01-02" });
  });
  const begin = async () => {
    const [source, destination] = await Promise.all([
      f.owner.query(api.cycles.index.get, { cycleId: sourceId, now: Date.now() }),
      f.owner.query(api.cycles.index.get, { cycleId: destinationId, now: Date.now() }),
    ]);
    return f.owner.mutation(api.cycles.transfer.begin, {
      sourceId,
      destinationId,
      expectedSourceUpdatedAt: source.updatedAt,
      expectedDestinationUpdatedAt: destination.updatedAt,
    });
  };
  return { ...f, sourceId, destinationId, taskIds, begin };
}
test("snapshot is immutable and completed/cancelled remain while unfinished tasks move in bounded steps", async () => {
  const f = await fixture(23);
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskIds[21], status: "done" });
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskIds[22], status: "cancelled" });
  const transferId = await f.begin();
  const initial = await f.owner.query(api.cycles.transfer.inspect, { transferId });
  expect(initial.job.snapshot.count).toBe(23);
  expect(initial.job.entries).toHaveLength(21);
  await f.owner.mutation(api.cycles.transfer.step, { transferId, expectedRevision: 0 });
  const progress = await f.owner.query(api.cycles.transfer.inspect, { transferId });
  expect(progress.job.status).toBe("running");
  expect(progress.job.entries.filter((row) => row.outcome === "moved")).toHaveLength(20);
  const remaining = progress.job.entries.find((row) => row.outcome === "pending")!;
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: remaining.taskId, status: "done" });
  await expect(f.owner.mutation(api.cycles.transfer.step, { transferId, expectedRevision: 1 })).rejects.toThrow(
    "changed"
  );
  const blocked = await f.owner.query(api.cycles.transfer.inspect, { transferId });
  expect(blocked.blockers).toHaveLength(1);
  await f.owner.mutation(api.cycles.transfer.skipChanged, {
    transferId,
    expectedRevision: 1,
    taskIds: [remaining.taskId],
  });
  const final = await f.owner.query(api.cycles.transfer.inspect, { transferId });
  expect(final.job.status).toBe("completed");
  expect(final.job.snapshot).toEqual(initial.job.snapshot);
  expect(final.job.entries.filter((row) => row.outcome === "skipped")).toHaveLength(1);
  expect((await f.owner.query(api.cycles.tasks.current, { taskId: f.taskIds[21] }))?._id).toBe(f.sourceId);
  expect((await f.owner.query(api.cycles.tasks.current, { taskId: f.taskIds[22] }))?._id).toBe(f.sourceId);
});
test("capacity and lifecycle changes pause atomically; cancellation leaves prior moves explicit", async () => {
  const f = await fixture(21);
  const transferId = await f.begin();
  const destinationTasks = await Promise.all(
    Array.from({ length: 81 }, (_, index) =>
      f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: `Destination task ${index}` })
    )
  );
  await f.t.run(async (ctx) => {
    await Promise.all(
      destinationTasks.map((taskId) => ctx.db.insert("cycleTasks", { cycleId: f.destinationId, taskId }))
    );
  });
  await expect(f.owner.mutation(api.cycles.transfer.step, { transferId, expectedRevision: 0 })).rejects.toThrow(
    "capacity"
  );
  expect(
    (await f.owner.query(api.cycles.transfer.inspect, { transferId })).job.entries.every(
      (row) => row.outcome === "pending"
    )
  ).toBe(true);
  await f.t.run(async (ctx) => {
    const rows = await ctx.db
      .query("cycleTasks")
      .withIndex("by_cycle", (q) => q.eq("cycleId", f.destinationId))
      .collect();
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
    await ctx.db.patch(f.destinationId, { archived: true });
  });
  await expect(f.owner.mutation(api.cycles.transfer.step, { transferId, expectedRevision: 0 })).rejects.toThrow(
    "cannot be changed"
  );
  await f.t.run((ctx) => ctx.db.patch(f.destinationId, { archived: false }));
  await f.owner.mutation(api.cycles.transfer.step, { transferId, expectedRevision: 0 });
  await f.owner.mutation(api.cycles.transfer.cancel, { transferId, expectedRevision: 1 });
  const result = await f.owner.query(api.cycles.transfer.inspect, { transferId });
  expect(result.job.status).toBe("cancelled");
  expect(result.job.entries.filter((row) => row.outcome === "pending")).toHaveLength(1);
  expect(result.job.entries.filter((row) => row.outcome === "moved")).toHaveLength(20);
});
test("source limits, guest snapshot redaction, revision conflicts and unchanged skips reject", async () => {
  const f = await fixture();
  const transferId = await f.begin();
  await expect(f.begin()).rejects.toThrow("existing transfer");
  await expect(
    f.owner.mutation(api.cycles.transfer.skipChanged, { transferId, expectedRevision: 0, taskIds: [f.taskIds[0]] })
  ).rejects.toThrow("Only changed");
  await expect(f.owner.mutation(api.cycles.transfer.step, { transferId, expectedRevision: 9 })).rejects.toThrow(
    "changed"
  );
  const userId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Guest" }));
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role: "guest" });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId, role: "guest" });
  const guest = await signedIn(f.t, userId);
  await expect(guest.query(api.cycles.transfer.inspect, { transferId })).rejects.toThrow();
  await f.owner.mutation(api.cycles.transfer.cancel, { transferId, expectedRevision: 0 });
  await f.t.run(async (ctx) => {
    await Promise.all(
      Array.from({ length: 100 }, () => ctx.db.insert("cycleTasks", { cycleId: f.sourceId, taskId: f.taskIds[0] }))
    );
  });
  await expect(f.begin()).rejects.toThrow("100-task");
});
test("pretransfer estimate and assignee/label distributions remain unchanged after metadata edits", async () => {
  const f = await fixture();
  const labelId = await f.owner.mutation(api.tasks.labels.save, {
    projectId: f.projectId,
    parentId: null,
    data: { name: "Snapshot label", description: "", color: "", sortOrder: 0 },
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
    await ctx.db.patch(f.taskIds[0], { estimatePointId: pointId, assigneeIds: [f.userId], labelIds: [labelId] });
  });
  const transferId = await f.begin();
  const before = (await f.owner.query(api.cycles.transfer.inspect, { transferId })).job.snapshot;
  expect(before.numericEstimates).toBe(3.5);
  expect(before.unquantifiedEstimates).toBe(0);
  expect(before.labels.find((row) => row.id === labelId)).toMatchObject({
    name: "Snapshot label",
    count: 1,
    numericEstimates: 3.5,
  });
  expect(before.assignees.find((row) => row.id === f.userId)?.count).toBe(1);
  await f.owner.mutation(api.tasks.labels.save, {
    projectId: f.projectId,
    labelId,
    parentId: null,
    expectedRevision: 0,
    data: { name: "Renamed", description: "", color: "", sortOrder: 0 },
  });
  expect((await f.owner.query(api.cycles.transfer.inspect, { transferId })).job.snapshot).toEqual(before);
});
test("changed cross-project references never disclose blocker task titles", async () => {
  const f = await fixture();
  const transferId = await f.begin();
  const foreignProjectId = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Foreign",
    identifier: "FOREIGN",
  });
  await f.t.run((ctx) => ctx.db.patch(f.taskIds[0], { projectId: foreignProjectId, title: "Must not be exposed" }));
  expect((await f.owner.query(api.cycles.transfer.inspect, { transferId })).blockers[0].title).toBe("Unavailable task");
});
