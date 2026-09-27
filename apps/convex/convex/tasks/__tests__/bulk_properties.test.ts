import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
test("bulk properties preserve untouched fields, union collections and explicitly clear dates", async () => {
  const f = await workspaceJourney();
  const id = await f.owner.mutation(api.tasks.index.create, {
    projectId: f.projectId,
    title: "Owned",
    description: "Keep body",
  });
  const capture = async () => ({
    taskId: id,
    expectedUpdatedAt: (await f.owner.query(api.tasks.index.get, { taskId: id })).updatedAt,
  });
  await f.owner.mutation(api.tasks.bulk_properties.update, {
    projectId: f.projectId,
    updates: [
      {
        ...(await capture()),
        patch: { assigneeIds: [f.userId], startDate: "2026-01-01", targetDate: "2026-01-03", priority: "high" },
      },
    ],
  });
  await f.owner.mutation(api.tasks.bulk_properties.update, {
    projectId: f.projectId,
    updates: [{ ...(await capture()), patch: { assigneeIds: [f.userId], startDate: null, status: "done" } }],
  });
  expect(await f.owner.query(api.tasks.index.get, { taskId: id })).toMatchObject({
    title: "Owned",
    description: "Keep body",
    assigneeIds: [f.userId],
    priority: "high",
    startDate: null,
    targetDate: "2026-01-03",
    status: "done",
  });
});
test("one invalid date or stale revision rolls back every task and event", async () => {
  const f = await workspaceJourney();
  const ids = await Promise.all(
    ["A", "B"].map((title) => f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title }))
  );
  const rows = await Promise.all(
    ids.map(async (taskId) => ({
      taskId,
      expectedUpdatedAt: (await f.owner.query(api.tasks.index.get, { taskId })).updatedAt,
    }))
  );
  const before = await f.t.run((ctx) => ctx.db.query("taskEvents").collect());
  await expect(
    f.owner.mutation(api.tasks.bulk_properties.update, {
      projectId: f.projectId,
      updates: [
        { ...rows[0], patch: { priority: "high" } },
        { ...rows[1], patch: { startDate: "2026-01-03", targetDate: "2026-01-01" } },
      ],
    })
  ).rejects.toThrow("Start date");
  expect((await f.owner.query(api.tasks.index.get, { taskId: ids[0] })).priority).toBe("none");
  expect(await f.t.run((ctx) => ctx.db.query("taskEvents").collect())).toEqual(before);
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: ids[1], status: "done" });
  await expect(
    f.owner.mutation(api.tasks.bulk_properties.update, {
      projectId: f.projectId,
      updates: rows.map((row) => ({
        taskId: row.taskId,
        expectedUpdatedAt: row.expectedUpdatedAt,
        patch: { priority: "high" as const },
      })),
    })
  ).rejects.toThrow("changed");
  expect((await f.owner.query(api.tasks.index.get, { taskId: ids[0] })).priority).toBe("none");
});
test("bulk properties reject foreign project tasks, inactive tasks, anonymous and empty changes", async () => {
  const f = await workspaceJourney();
  const projectId = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Other",
    identifier: "OTH",
  });
  const taskId = await f.owner.mutation(api.tasks.index.create, { projectId, title: "Other" });
  const task = await f.owner.query(api.tasks.index.get, { taskId });
  const row = { taskId, expectedUpdatedAt: task.updatedAt, patch: { priority: "high" as const } };
  await expect(
    f.owner.mutation(api.tasks.bulk_properties.update, { projectId: f.projectId, updates: [row] })
  ).rejects.toThrow("this project");
  await expect(f.t.mutation(api.tasks.bulk_properties.update, { projectId, updates: [row] })).rejects.toThrow(
    "Sign in"
  );
  await expect(
    f.owner.mutation(api.tasks.bulk_properties.update, { projectId, updates: [{ ...row, patch: {} }] })
  ).rejects.toThrow("at least one");
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId,
    expectedUpdatedAt: task.updatedAt,
    operation: "delete",
  });
  await expect(f.owner.mutation(api.tasks.bulk_properties.update, { projectId, updates: [row] })).rejects.toThrow(
    "not found"
  );
});
