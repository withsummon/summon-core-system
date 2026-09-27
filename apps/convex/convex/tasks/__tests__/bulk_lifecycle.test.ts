import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
async function fixture() {
  const f = await workspaceJourney();
  const ids = await Promise.all(
    ["A", "B"].map((title) => f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title }))
  );
  const snapshot = async () =>
    Promise.all(
      ids.map(async (taskId) => ({
        taskId,
        expectedUpdatedAt: (await f.owner.query(api.tasks.index.get, { taskId })).updatedAt,
      }))
    );
  return { ...f, ids, snapshot };
}
test("bulk archive validates every task before any lifecycle or event write", async () => {
  const f = await fixture();
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.ids[0], status: "done" });
  const tasks = await f.snapshot();
  const before = await f.t.run((ctx) => ctx.db.query("taskEvents").collect());
  await expect(
    f.owner.mutation(api.tasks.lifecycle.bulk, { projectId: f.projectId, operation: "archive", tasks })
  ).rejects.toThrow("completed");
  expect((await f.owner.query(api.tasks.index.get, { taskId: f.ids[0] })).archivedAt).toBeNull();
  expect(await f.t.run((ctx) => ctx.db.query("taskEvents").collect())).toEqual(before);
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.ids[1], status: "cancelled" });
  expect(
    await f.owner.mutation(api.tasks.lifecycle.bulk, {
      projectId: f.projectId,
      operation: "archive",
      tasks: await f.snapshot(),
    })
  ).toEqual({ selected: 2, changed: 2 });
  expect(
    await f.owner.mutation(api.tasks.lifecycle.bulk, {
      projectId: f.projectId,
      operation: "unarchive",
      tasks: await f.snapshot(),
    })
  ).toEqual({ selected: 2, changed: 2 });
});
test("bulk rejects stale, duplicated and oversized captures atomically", async () => {
  const f = await fixture();
  const tasks = await f.snapshot();
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.ids[1], status: "done" });
  await expect(
    f.owner.mutation(api.tasks.lifecycle.bulk, { projectId: f.projectId, operation: "delete", tasks })
  ).rejects.toThrow("changed");
  expect((await f.owner.query(api.tasks.index.get, { taskId: f.ids[0] })).deletedAt).toBeNull();
  for (const invalid of [[], [tasks[0], tasks[0]], Array.from({ length: 21 }, () => tasks[0])])
    await expect(
      f.owner.mutation(api.tasks.lifecycle.bulk, { projectId: f.projectId, operation: "delete", tasks: invalid })
    ).rejects.toThrow("1–20");
});
test("bulk deletion is admin-only even for task creator and preserves recovery", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", f.projectId).eq("userId", f.userId))
      .unique();
    await ctx.db.patch(membership!._id, { role: "member" });
  });
  await expect(
    f.owner.mutation(api.tasks.lifecycle.bulk, {
      projectId: f.projectId,
      operation: "delete",
      tasks: await f.snapshot(),
    })
  ).rejects.toThrow("administrators");
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.ids[0],
    operation: "delete",
    expectedUpdatedAt: (await f.snapshot())[0].expectedUpdatedAt,
  });
  const deleted = await f.t.run((ctx) => ctx.db.get(f.ids[0]));
  await f.owner.mutation(api.tasks.lifecycle.bulk, {
    projectId: f.projectId,
    operation: "restore",
    tasks: [{ taskId: f.ids[0], expectedUpdatedAt: deleted!.updatedAt }],
  });
  expect((await f.owner.query(api.tasks.index.get, { taskId: f.ids[0] })).deletedAt).toBeNull();
});
