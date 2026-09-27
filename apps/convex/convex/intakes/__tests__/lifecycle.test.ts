import { expect, test, vi } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
const paginationOpts = { cursor: null, numItems: 100 };
async function fixture() {
  const f = await workspaceJourney();
  await f.owner.mutation(api.intakes.index.configure, {
    projectId: f.projectId,
    expectedRevision: 0,
    enabled: true,
    guestViewAllFeatures: true,
  });
  const taskId = await f.owner.mutation(api.intakes.index.submit, {
    projectId: f.projectId,
    title: "Submission",
    html: "<p>Original</p>",
    priority: "none",
  });
  return { ...f, taskId };
}
async function remove(f: Awaited<ReturnType<typeof fixture>>) {
  const row = await f.owner.query(api.intakes.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.intakes.index.remove, {
    taskId: f.taskId,
    expectedUpdatedAt: row.intake.updatedAt,
    expectedTaskUpdatedAt: row.task.updatedAt,
  });
  return f.owner.query(api.intakes.lifecycle.get, { taskId: f.taskId });
}
async function accept(f: Awaited<ReturnType<typeof fixture>>) {
  await f.owner.mutation(api.tasks.states.save, {
    projectId: f.projectId,
    data: { name: "Ready", description: "", color: "", status: "todo", sortOrder: 0, isDefault: true },
  });
  const row = await f.owner.query(api.intakes.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.intakes.index.decide, {
    taskId: f.taskId,
    expectedUpdatedAt: row.intake.updatedAt,
    expectedTaskUpdatedAt: row.task.updatedAt,
    status: "accepted",
    snoozedUntil: null,
    duplicateTo: null,
  });
}
test("pending recovery retains identity/content and uses monotonic dual CAS across repeated removals", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-27T00:00:00Z"));
  try {
    const f = await fixture();
    const row = await remove(f);
    expect(row).toMatchObject({ canRestore: true, restoresTask: true, html: "<p>Original</p>" });
    const args = {
      taskId: f.taskId,
      expectedUpdatedAt: row.intake.updatedAt,
      expectedTaskUpdatedAt: row.task.updatedAt,
    };
    await f.owner.mutation(api.intakes.lifecycle.restore, args);
    const restored = await f.owner.query(api.intakes.index.get, { taskId: f.taskId });
    expect(restored.task).toMatchObject({ _id: f.taskId, sequence: 1, status: "triage", deletedAt: null });
    expect(restored.task.updatedAt).toBeGreaterThan(row.task.updatedAt);
    expect((await f.owner.query(api.intakes.lifecycle.list, { projectId: f.projectId, paginationOpts })).page).toEqual(
      []
    );
    await remove(f);
    await expect(f.owner.mutation(api.intakes.lifecycle.restore, args)).rejects.toThrow("changed");
  } finally {
    vi.useRealTimers();
  }
});
test("accepted bridge recovery never undeletes or unarchives a task changed independently", async () => {
  const f = await fixture();
  await accept(f);
  await remove(f);
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskId, status: "done" });
  let task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: task.updatedAt,
    operation: "archive",
  });
  task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: task.updatedAt,
    operation: "delete",
  });
  const row = await f.owner.query(api.intakes.lifecycle.get, { taskId: f.taskId });
  expect(row).toMatchObject({ canRestore: true, restoresTask: false });
  await f.owner.mutation(api.intakes.lifecycle.restore, {
    taskId: f.taskId,
    expectedUpdatedAt: row.intake.updatedAt,
    expectedTaskUpdatedAt: row.task.updatedAt,
  });
  const after = await f.t.run((ctx) => ctx.db.get(f.taskId));
  expect(after).toEqual(row.task);
  await expect(f.owner.query(api.intakes.index.get, { taskId: f.taskId })).rejects.toThrow("not found");
});
test("nonaccepted recovery refuses a fresh independently deleted task even with current CAS", async () => {
  const f = await fixture();
  await accept(f);
  let row = await f.owner.query(api.intakes.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.intakes.index.decide, {
    taskId: f.taskId,
    expectedUpdatedAt: row.intake.updatedAt,
    expectedTaskUpdatedAt: row.task.updatedAt,
    status: "rejected",
    snoozedUntil: null,
    duplicateTo: null,
  });
  const removed = await remove(f);
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: removed.task.updatedAt,
    operation: "restore",
  });
  const restored = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: restored.updatedAt,
    operation: "delete",
  });
  const changed = await f.owner.query(api.intakes.lifecycle.get, { taskId: f.taskId });
  expect(changed.canRestore).toBe(false);
  await expect(
    f.owner.mutation(api.intakes.lifecycle.restore, {
      taskId: f.taskId,
      expectedUpdatedAt: changed.intake.updatedAt,
      expectedTaskUpdatedAt: changed.task.updatedAt,
    })
  ).rejects.toThrow("separately");
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: changed.task.updatedAt,
    operation: "restore",
  });
  const active = await f.owner.query(api.intakes.lifecycle.get, { taskId: f.taskId });
  expect(active.restoresTask).toBe(false);
  await f.owner.mutation(api.intakes.lifecycle.restore, {
    taskId: f.taskId,
    expectedUpdatedAt: active.intake.updatedAt,
    expectedTaskUpdatedAt: active.task.updatedAt,
  });
  row = await f.owner.query(api.intakes.index.get, { taskId: f.taskId });
  expect(row.task.status).toBe("todo");
});
test("trash does not inherit guest view-all; creator revocation and missing legacy receipt fail closed", async () => {
  const f = await fixture();
  const removed = await remove(f);
  const guestId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Guest" }));
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: guestId,
    role: "guest",
  });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId: guestId, role: "guest" });
  const guest = f.t.withIdentity({ subject: guestId });
  expect((await guest.query(api.intakes.lifecycle.list, { projectId: f.projectId, paginationOpts })).page).toEqual([]);
  await expect(guest.query(api.intakes.lifecycle.get, { taskId: f.taskId })).rejects.toThrow("not found");
  await expect(
    guest.mutation(api.intakes.lifecycle.restore, {
      taskId: f.taskId,
      expectedUpdatedAt: removed.intake.updatedAt,
      expectedTaskUpdatedAt: removed.task.updatedAt,
    })
  ).rejects.toThrow("not found");
  const own = await guest.mutation(api.intakes.index.submit, {
    projectId: f.projectId,
    title: "Guest own",
    html: "",
    priority: "none",
  });
  const ownrow = await guest.query(api.intakes.index.get, { taskId: own });
  await guest.mutation(api.intakes.index.remove, {
    taskId: own,
    expectedUpdatedAt: ownrow.intake.updatedAt,
    expectedTaskUpdatedAt: ownrow.task.updatedAt,
  });
  expect((await guest.query(api.intakes.lifecycle.get, { taskId: own })).canRestore).toBe(true);
  await f.owner.mutation(api.projects.index.revokeMember, { projectId: f.projectId, userId: guestId });
  await expect(guest.query(api.intakes.lifecycle.get, { taskId: own })).rejects.toThrow("access");
  await f.t.run((ctx) => ctx.db.patch(removed.intake._id, { removalTaskRevision: undefined }));
  const historical = await f.owner.query(api.intakes.lifecycle.get, { taskId: f.taskId });
  expect(historical.canRestore).toBe(false);
  await expect(
    f.owner.mutation(api.intakes.lifecycle.restore, {
      taskId: f.taskId,
      expectedUpdatedAt: historical.intake.updatedAt,
      expectedTaskUpdatedAt: historical.task.updatedAt,
    })
  ).rejects.toThrow("separately");
});
