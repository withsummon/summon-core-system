import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import type { FunctionArgs } from "convex/server";
async function setup() {
  const f = await workspaceJourney();
  const a = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "A" });
  const b = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "B" });
  async function add(kind: FunctionArgs<typeof api.tasks.relationships.add>["kind"], taskId = a, relatedTaskId = b) {
    const task = await f.owner.query(api.tasks.index.get, { taskId });
    const related = await f.owner.query(api.tasks.index.get, { taskId: relatedTaskId });
    return f.owner.mutation(api.tasks.relationships.add, {
      taskId,
      relatedTaskId,
      kind,
      expectedUpdatedAt: task.updatedAt,
      expectedRelatedUpdatedAt: related.updatedAt,
    });
  }
  return { ...f, a, b, add };
}
test.each([
  ["start_before", "start_after"],
  ["finish_before", "finish_after"],
  ["implemented_by", "implements"],
  ["blocks", "blocked_by"],
] as const)("directed %s projects its inverse %s and rejects duplicate pair", async (forward, reverse) => {
  const f = await setup();
  await f.add(reverse);
  expect((await f.owner.query(api.tasks.relationships.list, { taskId: f.a }))[0].direction).toBe(reverse);
  expect((await f.owner.query(api.tasks.relationships.list, { taskId: f.b }))[0].direction).toBe(forward);
  await expect(f.add(forward, f.b, f.a)).rejects.toThrow("already");
  const relation = (await f.owner.query(api.tasks.relationships.list, { taskId: f.a }))[0];
  const task = await f.owner.query(api.tasks.index.get, { taskId: f.a });
  await f.owner.mutation(api.tasks.relationships.remove, {
    taskId: f.a,
    relationId: relation.relation._id,
    expectedUpdatedAt: task.updatedAt,
  });
  expect(await f.owner.query(api.tasks.relationships.list, { taskId: f.b })).toEqual([]);
});
test("blocking inverses preserve DAG while scheduling relations do not invent a scheduling cycle policy", async () => {
  const f = await setup();
  const c = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "C" });
  await f.add("blocks");
  await f.add("blocks", f.b, c);
  await expect(f.add("blocked_by", f.a, c)).rejects.toThrow("cycle");
  await f.add("start_before", c, f.a);
  expect(
    (await f.owner.query(api.tasks.relationships.list, { taskId: c })).some((row) => row.direction === "start_before")
  ).toBe(true);
});
test("new relation types keep current ACL, self relation and captured revision boundaries", async () => {
  const f = await setup();
  await expect(f.add("implements", f.a, f.a)).rejects.toThrow("itself");
  const task = await f.owner.query(api.tasks.index.get, { taskId: f.a });
  const related = await f.owner.query(api.tasks.index.get, { taskId: f.b });
  const args = {
    taskId: f.a,
    relatedTaskId: f.b,
    kind: "start_before" as const,
    expectedUpdatedAt: task.updatedAt,
    expectedRelatedUpdatedAt: related.updatedAt,
  };
  await expect(f.t.mutation(api.tasks.relationships.add, args)).rejects.toThrow("Sign in");
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.a, status: "done" });
  await expect(f.owner.mutation(api.tasks.relationships.add, args)).rejects.toThrow("changed");
});
