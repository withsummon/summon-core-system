import { signedIn } from "../../../test-support/session";
import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
const paginationOpts = { cursor: null, numItems: 100 };
async function setup() {
  const f = await workspaceJourney();
  await f.owner.mutation(api.intakes.index.configure, {
    projectId: f.projectId,
    expectedRevision: 0,
    enabled: true,
    guestViewAllFeatures: false,
  });
  return f;
}
async function submit(f: Awaited<ReturnType<typeof setup>>) {
  return f.owner.mutation(api.intakes.index.submit, {
    projectId: f.projectId,
    title: "Incoming",
    html: "<p><strong>Original</strong><script>bad()</script></p>",
    priority: "high",
  });
}
test("submission allocates stable identity/sequence; acceptance is atomic and needs existing default state", async () => {
  const f = await setup();
  const taskId = await submit(f);
  const initial = await f.owner.query(api.intakes.index.get, { taskId });
  expect(initial.task).toMatchObject({ status: "triage", sequence: 1 });
  expect(initial.html).not.toContain("script");
  expect((await f.owner.query(api.tasks.index.list, { projectId: f.projectId, paginationOpts })).page).toEqual([]);
  await expect(f.owner.query(api.tasks.index.get, { taskId })).rejects.toThrow("not found");
  const args = {
    taskId,
    expectedUpdatedAt: initial.intake.updatedAt,
    expectedTaskUpdatedAt: initial.task.updatedAt,
    status: "accepted" as const,
    snoozedUntil: null,
    duplicateTo: null,
  };
  await expect(f.owner.mutation(api.intakes.index.decide, args)).rejects.toThrow("no default state");
  expect((await f.owner.query(api.intakes.index.get, { taskId })).intake.status).toBe("pending");
  const stateId = await f.owner.mutation(api.tasks.states.save, {
    projectId: f.projectId,
    data: { name: "Ready", description: "", color: "blue", status: "todo", sortOrder: 0, isDefault: true },
  });
  await f.owner.mutation(api.intakes.index.decide, args);
  const accepted = await f.owner.query(api.tasks.index.get, { taskId });
  expect(accepted).toMatchObject({ _id: taskId, sequence: 1, status: "todo", stateId });
  const ordinaryId = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Ordinary" });
  expect((await f.owner.query(api.tasks.index.get, { taskId: ordinaryId })).sequence).toBe(2);
  await expect(f.owner.mutation(api.intakes.index.decide, args)).rejects.toThrow("changed");
  const row = await f.owner.query(api.intakes.index.get, { taskId });
  await f.owner.mutation(api.intakes.index.decide, {
    ...args,
    expectedUpdatedAt: row.intake.updatedAt,
    expectedTaskUpdatedAt: row.task.updatedAt,
    status: "rejected",
  });
  expect((await f.owner.query(api.tasks.index.get, { taskId })).status).toBe("todo");
});
test("guest creator edits text, other guest visibility follows flag, administrators alone decide", async () => {
  const f = await setup();
  const guestId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Guest" }));
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: guestId,
    role: "guest",
  });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId: guestId, role: "guest" });
  const guest = await signedIn(f.t, guestId);
  const ownId = await guest.mutation(api.intakes.index.submit, {
    projectId: f.projectId,
    title: "Guest",
    html: "<p>body</p>",
    priority: "none",
  });
  const otherId = await submit(f);
  const row = await guest.query(api.intakes.index.get, { taskId: ownId });
  const version = { taskId: ownId, expectedUpdatedAt: row.intake.updatedAt, expectedTaskUpdatedAt: row.task.updatedAt };
  await expect(guest.query(api.intakes.index.get, { taskId: otherId })).rejects.toThrow("not found");
  expect(
    (await guest.query(api.intakes.index.list, { projectId: f.projectId, paginationOpts })).page.map((r) => r.task._id)
  ).toEqual([ownId]);
  await expect(
    guest.mutation(api.intakes.index.edit, { ...version, title: "Edited", html: "<p>Edited</p>", priority: "urgent" })
  ).rejects.toThrow("Guests");
  await guest.mutation(api.intakes.index.edit, { ...version, title: "Edited", html: "<p>Edited</p>" });
  await expect(
    guest.mutation(api.intakes.index.decide, { ...version, status: "rejected", snoozedUntil: null, duplicateTo: null })
  ).rejects.toThrow("administrators");
  await f.owner.mutation(api.intakes.index.configure, {
    projectId: f.projectId,
    expectedRevision: 1,
    enabled: true,
    guestViewAllFeatures: true,
  });
  expect((await guest.query(api.intakes.index.get, { taskId: otherId })).canEdit).toBe(false);
  await f.owner.mutation(api.projects.index.revokeMember, { projectId: f.projectId, userId: guestId });
  await expect(guest.query(api.intakes.index.get, { taskId: ownId })).rejects.toThrow("access");
});
test("reserved triage cannot be chosen through normal task/state APIs; configuration CAS and disable gate submission", async () => {
  const f = await setup();
  const taskId = await submit(f);
  const row = await f.owner.query(api.intakes.index.get, { taskId });
  expect(await f.owner.query(api.tasks.states.list, { projectId: f.projectId })).toEqual([]);
  await expect(
    f.owner.mutation(api.tasks.index.create, {
      projectId: f.projectId,
      title: "Bypass",
      properties: {
        priority: "none",
        assigneeIds: [],
        labelIds: [],
        startDate: null,
        targetDate: null,
        stateId: row.task.stateId,
        estimatePointId: row.task.estimatePointId,
      },
    })
  ).rejects.toThrow("intake");
  await expect(
    f.owner.mutation(api.tasks.states.save, {
      projectId: f.projectId,
      stateId: row.task.stateId!,
      data: { name: "Rename", description: "", color: "", status: "todo", sortOrder: 1, isDefault: true },
    })
  ).rejects.toThrow("intake");
  await expect(
    f.owner.mutation(api.intakes.index.configure, {
      projectId: f.projectId,
      expectedRevision: 0,
      enabled: false,
      guestViewAllFeatures: false,
    })
  ).rejects.toThrow("changed");
  await f.owner.mutation(api.intakes.index.configure, {
    projectId: f.projectId,
    expectedRevision: 1,
    enabled: false,
    guestViewAllFeatures: false,
  });
  await expect(submit(f)).rejects.toThrow("not enabled");
  expect((await f.owner.query(api.intakes.index.get, { taskId })).task._id).toBe(taskId);
});
test("soft removal preserves accepted task and removes nonaccepted task without resetting identity", async () => {
  const f = await setup();
  const pendingId = await submit(f);
  let row = await f.owner.query(api.intakes.index.get, { taskId: pendingId });
  await f.owner.mutation(api.intakes.index.remove, {
    taskId: pendingId,
    expectedUpdatedAt: row.intake.updatedAt,
    expectedTaskUpdatedAt: row.task.updatedAt,
  });
  await expect(f.owner.query(api.intakes.index.get, { taskId: pendingId })).rejects.toThrow("not found");
  expect((await f.t.run((ctx) => ctx.db.get(pendingId)))?.deletedAt).not.toBeNull();
  await f.owner.mutation(api.tasks.states.save, {
    projectId: f.projectId,
    data: { name: "Ready", description: "", color: "", status: "todo", sortOrder: 1, isDefault: true },
  });
  const acceptedId = await submit(f);
  row = await f.owner.query(api.intakes.index.get, { taskId: acceptedId });
  await f.owner.mutation(api.intakes.index.decide, {
    taskId: acceptedId,
    expectedUpdatedAt: row.intake.updatedAt,
    expectedTaskUpdatedAt: row.task.updatedAt,
    status: "accepted",
    snoozedUntil: null,
    duplicateTo: null,
  });
  row = await f.owner.query(api.intakes.index.get, { taskId: acceptedId });
  await f.owner.mutation(api.intakes.index.remove, {
    taskId: acceptedId,
    expectedUpdatedAt: row.intake.updatedAt,
    expectedTaskUpdatedAt: row.task.updatedAt,
  });
  expect((await f.owner.query(api.tasks.index.get, { taskId: acceptedId })).sequence).toBe(2);
});
test("pending tasks are excluded from workspace/report projections and ordinary content/mutation boundaries", async () => {
  const f = await setup();
  const taskId = await submit(f);
  const row = await f.owner.query(api.intakes.index.get, { taskId });
  expect(
    (
      await f.owner.query(api.tasks.center.list, {
        workspaceId: f.workspaceId,
        paginationOpts,
        scope: "all",
        due: "all",
        today: "2026-09-27",
      })
    ).page
  ).toEqual([]);
  expect((await f.owner.query(api.reporting.overview.project, { projectId: f.projectId })).recentTasks).toEqual([]);
  const report = await f.owner.query(api.reporting.tasks.page, {
    scope: {
      workspaceId: f.workspaceId,
      projectId: f.projectId,
      clientId: null,
      dateFrom: null,
      dateTo: null,
      today: "2026-09-27",
    },
    paginationOpts,
  });
  expect(report.contribution.total).toBe(0);
  await expect(f.owner.query(api.tasks.description.get, { taskId })).rejects.toThrow("not found");
  await expect(f.owner.query(api.tasks.comments.list, { taskId, paginationOpts })).rejects.toThrow("not found");
  await expect(f.owner.mutation(api.tasks.index.setStatus, { taskId, status: "todo" })).rejects.toThrow("not found");
  await expect(
    f.owner.mutation(api.tasks.lifecycle.change, { taskId, expectedUpdatedAt: row.task.updatedAt, operation: "delete" })
  ).rejects.toThrow("not found");
  const normal = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Normal" });
  await expect(
    f.owner.mutation(api.tasks.index.create, {
      projectId: f.projectId,
      title: "Child",
      parent: { taskId, expectedUpdatedAt: row.task.updatedAt },
    })
  ).rejects.toThrow("not found");
  expect(
    (await f.owner.query(api.tasks.index.list, { projectId: f.projectId, paginationOpts })).page.map((t) => t._id)
  ).toEqual([normal]);
});
test("snooze and duplicate decisions validate scope; cursor budgets cannot be expanded", async () => {
  const f = await setup();
  const taskId = await submit(f);
  let row = await f.owner.query(api.intakes.index.get, { taskId });
  const version = { taskId, expectedUpdatedAt: row.intake.updatedAt, expectedTaskUpdatedAt: row.task.updatedAt };
  await expect(
    f.owner.mutation(api.intakes.index.decide, {
      ...version,
      status: "snoozed",
      snoozedUntil: Infinity,
      duplicateTo: null,
    })
  ).rejects.toThrow("valid snooze");
  await expect(
    f.owner.mutation(api.intakes.index.decide, {
      ...version,
      status: "duplicate",
      snoozedUntil: null,
      duplicateTo: taskId,
    })
  ).rejects.toThrow();
  const projectId = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Other",
    identifier: "OTH",
  });
  const foreign = await f.owner.mutation(api.tasks.index.create, { projectId, title: "Foreign" });
  await expect(
    f.owner.mutation(api.intakes.index.decide, {
      ...version,
      status: "duplicate",
      snoozedUntil: null,
      duplicateTo: foreign,
    })
  ).rejects.toThrow("this project");
  const target = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Target" });
  await f.owner.mutation(api.intakes.index.decide, {
    ...version,
    status: "duplicate",
    snoozedUntil: null,
    duplicateTo: target,
  });
  row = await f.owner.query(api.intakes.index.get, { taskId });
  expect(row.duplicateTarget?.title).toBe("Target");
  expect(row.task.status).toBe("triage");
  const targetTask = await f.owner.query(api.tasks.index.get, { taskId: target });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: target,
    expectedUpdatedAt: targetTask.updatedAt,
    operation: "delete",
  });
  expect((await f.owner.query(api.intakes.index.get, { taskId })).duplicateTarget).toBeNull();
  await expect(
    f.owner.query(api.intakes.index.list, { projectId: f.projectId, paginationOpts: { cursor: null, numItems: 101 } })
  ).rejects.toThrow();
  const page = await f.owner.query(api.intakes.index.list, {
    projectId: f.projectId,
    status: "duplicate",
    paginationOpts: { cursor: null, numItems: 1 },
  });
  expect(page.page).toHaveLength(1);
});
