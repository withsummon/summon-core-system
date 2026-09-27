import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
const paginationOpts = { cursor: null, numItems: 1 };
test("activity pages canonical creation/status events and reveals only display identity", async () => {
  const f = await workspaceJourney();
  const taskId = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Activity" });
  await f.owner.mutation(api.tasks.index.setStatus, { taskId, status: "done" });
  const first = await f.owner.query(api.tasks.activity.list, { taskId, paginationOpts });
  expect(first.page).toHaveLength(1);
  expect(first.page[0]).toMatchObject({ kind: "status_changed", status: "done" });
  expect(Object.keys(first.page[0]).toSorted()).toEqual(["actorName", "at", "changes", "id", "kind", "status"]);
  expect(first.isDone).toBe(false);
  const second = await f.owner.query(api.tasks.activity.list, {
    taskId,
    paginationOpts: { ...paginationOpts, cursor: first.continueCursor },
  });
  expect(second.page[0].kind).toBe("created");
  await expect(
    f.owner.query(api.tasks.activity.list, { taskId, paginationOpts: { cursor: null, numItems: 101 } })
  ).rejects.toThrow("Page size");
});
test("activity rechecks guest ownership, membership revocation and trash visibility", async () => {
  const f = await workspaceJourney();
  const taskId = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Private activity" });
  const guestId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Guest" }));
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: guestId,
    role: "guest",
  });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId: guestId, role: "guest" });
  const guest = await signedIn(f.t, guestId);
  await expect(guest.query(api.tasks.activity.list, { taskId, paginationOpts })).rejects.toThrow("not found");
  await f.t.run((ctx) => ctx.db.patch(taskId, { createdBy: guestId }));
  expect((await guest.query(api.tasks.activity.list, { taskId, paginationOpts })).page).toHaveLength(1);
  await f.owner.mutation(api.workspaces.index.revokeMember, { workspaceId: f.workspaceId, userId: guestId });
  await expect(guest.query(api.tasks.activity.list, { taskId, paginationOpts })).rejects.toThrow("access");
  const task = await f.owner.query(api.tasks.index.get, { taskId });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId,
    expectedUpdatedAt: task.updatedAt,
    operation: "delete",
  });
  await expect(f.owner.query(api.tasks.activity.list, { taskId, paginationOpts })).rejects.toThrow("not found");
});
