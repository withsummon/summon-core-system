import { expect, test, vi, afterEach } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
afterEach(() => vi.useRealTimers());
const paginationOpts = { cursor: null, numItems: 20 };
async function fixture() {
  const f = await workspaceJourney();
  const taskId = await f.owner.mutation(api.tasks.index.create, {
    projectId: f.projectId,
    title: "History",
    description: "Initial",
  });
  return { ...f, taskId, scope: { kind: "task" as const, taskId } };
}
test("same actor coalesces through rolling600s, no-op preserves version, outside window appends", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1000000);
  const f = await fixture();
  const initial = (await f.owner.query(api.tasks.history.list, { scope: f.scope, paginationOpts })).page[0];
  async function save(html: string) {
    const task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
    await f.owner.mutation(api.tasks.description.save, { taskId: f.taskId, expectedUpdatedAt: task.updatedAt, html });
  }
  vi.setSystemTime(1600000);
  await save("<p>Second</p>");
  vi.setSystemTime(2200000);
  await save("<p>Third</p>");
  const merged = await f.owner.query(api.tasks.history.get, { scope: f.scope, versionId: initial._id });
  expect(merged).toMatchObject({ revision: 2, description: "Third", lastSavedAt: 2200000 });
  await save("<p>Third</p>");
  expect((await f.owner.query(api.tasks.history.get, { scope: f.scope, versionId: initial._id })).revision).toBe(2);
  vi.setSystemTime(2800001);
  await save("<p>Fourth</p>");
  expect((await f.owner.query(api.tasks.history.list, { scope: f.scope, paginationOpts })).page).toHaveLength(2);
});
test("restore validates mutable version and task CAS and does not accept a different task's version", async () => {
  const f = await fixture();
  const version = (await f.owner.query(api.tasks.history.list, { scope: f.scope, paginationOpts })).page[0];
  let task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.description.save, {
    taskId: f.taskId,
    expectedUpdatedAt: task.updatedAt,
    html: "<p>Changed</p>",
  });
  task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  const args = {
    scope: f.scope,
    versionId: version._id,
    expectedVersionRevision: version.revision,
    expectedTaskUpdatedAt: task.updatedAt,
  };
  await expect(f.owner.mutation(api.tasks.history.restore, args)).rejects.toThrow("version changed");
  await expect(
    f.owner.mutation(api.tasks.history.restore, {
      ...args,
      expectedVersionRevision: 1,
      expectedTaskUpdatedAt: task.updatedAt - 1,
    })
  ).rejects.toThrow("changed");
  const other = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Other" });
  await expect(
    f.owner.query(api.tasks.history.get, { scope: { kind: "task", taskId: other }, versionId: version._id })
  ).rejects.toThrow("not found");
});
test("guest history and ordinary task reads share creator restriction; revocation and deleted history deny", async () => {
  const f = await fixture();
  const guestId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Guest" }));
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: guestId,
    role: "guest",
  });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId: guestId, role: "guest" });
  const guest = f.t.withIdentity({ subject: guestId });
  await expect(guest.query(api.tasks.index.get, { taskId: f.taskId })).rejects.toThrow("not found");
  await expect(guest.query(api.tasks.history.list, { scope: f.scope, paginationOpts })).rejects.toThrow("not found");
  await f.t.run((ctx) => ctx.db.patch(f.projectId, { guestViewAllFeatures: true }));
  expect((await guest.query(api.tasks.history.list, { scope: f.scope, paginationOpts })).page).toHaveLength(1);
  await f.owner.mutation(api.projects.index.revokeMember, { projectId: f.projectId, userId: guestId });
  await expect(guest.query(api.tasks.history.list, { scope: f.scope, paginationOpts })).rejects.toThrow("access");
  const task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: task.updatedAt,
    operation: "delete",
  });
  await expect(f.owner.query(api.tasks.history.list, { scope: f.scope, paginationOpts })).rejects.toThrow("not found");
});

test("different actor appends; restoring older HTML creates current content atomically and archive rejects restore", async () => {
  const f = await fixture();
  const original = (await f.owner.query(api.tasks.history.list, { scope: f.scope, paginationOpts })).page[0];
  const id = await f.t.run((ctx) => ctx.db.insert("users", { name: "Editor" }));
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId: id, role: "member" });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId: id, role: "member" });
  const editor = f.t.withIdentity({ subject: id });
  let task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await editor.mutation(api.tasks.description.save, {
    taskId: f.taskId,
    expectedUpdatedAt: task.updatedAt,
    html: "<p><strong>Other edit</strong></p>",
  });
  expect((await f.owner.query(api.tasks.history.list, { scope: f.scope, paginationOpts })).page).toHaveLength(2);
  task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.history.restore, {
    scope: f.scope,
    versionId: original._id,
    expectedVersionRevision: 0,
    expectedTaskUpdatedAt: task.updatedAt,
  });
  expect((await f.owner.query(api.tasks.index.get, { taskId: f.taskId })).description).toBe("Initial");
  expect((await f.owner.query(api.tasks.history.list, { scope: f.scope, paginationOpts })).page).toHaveLength(3);
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskId, status: "done" });
  task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: task.updatedAt,
    operation: "archive",
  });
  task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  expect((await f.owner.query(api.tasks.history.list, { scope: f.scope, paginationOpts })).page).toHaveLength(3);
  await expect(
    f.owner.mutation(api.tasks.history.restore, {
      scope: f.scope,
      versionId: original._id,
      expectedVersionRevision: 0,
      expectedTaskUpdatedAt: task.updatedAt,
    })
  ).rejects.toThrow("not found");
});

test("intake history preserves identity after acceptance and requires bridge CAS before restore", async () => {
  const f = await workspaceJourney();
  await f.owner.mutation(api.intakes.index.configure, {
    projectId: f.projectId,
    expectedRevision: 0,
    enabled: true,
    guestViewAllFeatures: false,
  });
  const taskId = await f.owner.mutation(api.intakes.index.submit, {
    projectId: f.projectId,
    title: "Intake",
    html: "<p>Source<script>bad()</script></p>",
    priority: "none",
  });
  const scope = { kind: "intake" as const, taskId };
  const version = (await f.owner.query(api.tasks.history.list, { scope, paginationOpts })).page[0];
  expect((await f.owner.query(api.tasks.history.get, { scope, versionId: version._id })).html).toBe("<p>Source</p>");
  const row = await f.owner.query(api.intakes.index.get, { taskId });
  await expect(
    f.owner.mutation(api.tasks.history.restore, {
      scope,
      versionId: version._id,
      expectedVersionRevision: 0,
      expectedTaskUpdatedAt: row.task.updatedAt,
      expectedIntakeUpdatedAt: row.intake.updatedAt - 1,
    })
  ).rejects.toThrow("changed");
  await f.owner.mutation(api.tasks.history.restore, {
    scope,
    versionId: version._id,
    expectedVersionRevision: 0,
    expectedTaskUpdatedAt: row.task.updatedAt,
    expectedIntakeUpdatedAt: row.intake.updatedAt,
  });
  await f.owner.mutation(api.tasks.states.save, {
    projectId: f.projectId,
    data: { name: "Todo", description: "", color: "#fff", status: "todo", sortOrder: 0, isDefault: true },
  });
  const latest = await f.owner.query(api.intakes.index.get, { taskId });
  await f.owner.mutation(api.intakes.index.decide, {
    taskId,
    expectedUpdatedAt: latest.intake.updatedAt,
    expectedTaskUpdatedAt: latest.task.updatedAt,
    status: "accepted",
    snoozedUntil: null,
    duplicateTo: null,
  });
  expect(
    (await f.owner.query(api.tasks.history.list, { scope: { kind: "task", taskId }, paginationOpts })).page[0]._id
  ).toBe(version._id);
});
