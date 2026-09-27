import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { initialProperties } from "../properties";
const paginationOpts = { cursor: null, numItems: 50 };
async function fixture() {
  const f = await workspaceJourney();
  const taskId = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Before" });
  const labelId = await f.t.run((ctx) =>
    ctx.db.insert("taskLabels", {
      projectId: f.projectId,
      workspaceId: f.workspaceId,
      name: "Original label",
      description: "",
      color: "#ffffff",
      sortOrder: 0,
      parentId: null,
      revision: 0,
      retiring: false,
    })
  );
  const stateId = await f.t.run((ctx) =>
    ctx.db.insert("taskStates", {
      projectId: f.projectId,
      workspaceId: f.workspaceId,
      name: "Review",
      description: "",
      color: "#ffffff",
      sortOrder: 10,
      status: "in_progress",
      isDefault: false,
    })
  );
  const systemId = await f.owner.mutation(api.estimates.index.create, {
    projectId: f.projectId,
    name: "Points",
    description: "",
    type: "points",
    points: [{ key: 0, value: "3", description: "" }],
  });
  await f.owner.mutation(api.estimates.index.select, { projectId: f.projectId, systemId, expectedRevision: 0 });
  const system = await f.owner.query(api.estimates.index.get, { systemId });
  return { ...f, taskId, labelId, stateId, systemId, pointId: system.points[0]._id };
}
test("single save records all property values once and snapshots survive taxonomy renaming/deletion", async () => {
  const f = await fixture();
  const task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  const { completedAt: _completedAt, ...properties } = initialProperties;
  await f.owner.mutation(api.tasks.index.update, {
    ...properties,
    taskId: f.taskId,
    expectedUpdatedAt: task.updatedAt,
    title: "After",
    description: "",
    priority: "high",
    status: "in_progress",
    stateId: f.stateId,
    startDate: "2026-09-27",
    targetDate: "2026-09-28",
    assigneeIds: [f.userId],
    labelIds: [f.labelId],
    estimatePointId: f.pointId,
  });
  const rows = await f.owner.query(api.tasks.activity.list, { taskId: f.taskId, paginationOpts });
  expect(rows.page).toHaveLength(2);
  expect(rows.page[0].changes?.map((change) => change.field)).toEqual([
    "title",
    "priority",
    "state",
    "startDate",
    "targetDate",
    "assignees",
    "labels",
    "estimate",
  ]);
  expect(rows.page[0].changes).toContainEqual({ field: "title", before: "Before", after: "After" });
  expect(rows.page[0].changes).toContainEqual({
    field: "estimate",
    before: null,
    after: { id: f.pointId, value: "3" },
  });
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.labelId, { name: "Renamed" });
    await ctx.db.delete(f.pointId);
  });
  expect((await f.owner.query(api.tasks.activity.list, { taskId: f.taskId, paginationOpts })).page[0].changes).toEqual(
    rows.page[0].changes
  );
  await expect(
    f.owner.mutation(api.tasks.index.update, {
      ...properties,
      taskId: f.taskId,
      expectedUpdatedAt: task.updatedAt,
      title: "Stale",
      description: "",
      status: "todo",
    })
  ).rejects.toThrow("changed");
  expect((await f.owner.query(api.tasks.activity.list, { taskId: f.taskId, paginationOpts })).page).toHaveLength(2);
});
test("bulk additive fields capture per-task differences, no-op sets do not invent deltas, status clearing records prior state", async () => {
  const f = await fixture();
  let task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.bulk_properties.update, {
    projectId: f.projectId,
    updates: [
      {
        taskId: f.taskId,
        expectedUpdatedAt: task.updatedAt,
        patch: { labelIds: [f.labelId], assigneeIds: [f.userId], stateId: f.stateId },
      },
    ],
  });
  task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.bulk_properties.update, {
    projectId: f.projectId,
    updates: [
      {
        taskId: f.taskId,
        expectedUpdatedAt: task.updatedAt,
        patch: { labelIds: [f.labelId, f.labelId], assigneeIds: [f.userId] },
      },
    ],
  });
  expect((await f.owner.query(api.tasks.activity.list, { taskId: f.taskId, paginationOpts })).page[0].changes).toEqual(
    []
  );
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskId, status: "done" });
  expect((await f.owner.query(api.tasks.activity.list, { taskId: f.taskId, paginationOpts })).page[0].changes).toEqual([
    {
      field: "state",
      before: { id: f.stateId, name: "Review", status: "in_progress" },
      after: { id: null, name: null, status: "done" },
    },
  ]);
});
test("label retirement records the removed name before deleting taxonomy and old creation stays coarse", async () => {
  const f = await fixture();
  const task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.bulk_properties.update, {
    projectId: f.projectId,
    updates: [{ taskId: f.taskId, expectedUpdatedAt: task.updatedAt, patch: { labelIds: [f.labelId] } }],
  });
  const jobId = await f.owner.mutation(api.tasks.label_removal.begin, { labelId: f.labelId, expectedRevision: 0 });
  for (let page = 0; page < 8; page++) {
    // Each page consumes the cursor committed by the preceding page.
    // eslint-disable-next-line no-await-in-loop
    const result = await f.owner.mutation(api.tasks.label_removal.step, { jobId });
    if (result.done) break;
  }
  expect(await f.t.run((ctx) => ctx.db.get(f.labelId))).toBeNull();
  const rows = await f.owner.query(api.tasks.activity.list, { taskId: f.taskId, paginationOpts });
  expect(rows.page[0].changes).toEqual([
    { field: "labels", added: [], removed: [{ id: f.labelId, name: "Original label" }] },
  ]);
  expect(rows.page.at(-1)?.changes).toBeNull();
});

test("estimate removal snapshots the original value once through resumable remapping", async () => {
  const f = await fixture();
  const task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.bulk_properties.update, {
    projectId: f.projectId,
    updates: [{ taskId: f.taskId, expectedUpdatedAt: task.updatedAt, patch: { estimatePointId: f.pointId } }],
  });
  const jobId = await f.owner.mutation(api.estimates.remap.begin, {
    systemId: f.systemId,
    pointId: f.pointId,
    expectedSystemRevision: 0,
    expectedPointRevision: 0,
    replacementId: null,
  });
  const page = await f.owner.mutation(api.estimates.remap.page, { jobId, expectedRevision: 0 });
  await f.owner.mutation(api.estimates.remap.page, { jobId, expectedRevision: page.revision });
  const rows = await f.owner.query(api.tasks.activity.list, { taskId: f.taskId, paginationOpts });
  expect(rows.page[0].changes).toEqual([{ field: "estimate", before: { id: f.pointId, value: "3" }, after: null }]);
  expect(rows.page).toHaveLength(3);
});
