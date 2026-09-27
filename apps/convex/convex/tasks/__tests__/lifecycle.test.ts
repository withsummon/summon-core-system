import { signedIn } from "../../../test-support/session";
import { expect, test, vi } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
const page = { cursor: null, numItems: 100 };
async function fixture() {
  const f = await workspaceJourney();
  const taskId = await f.owner.mutation(api.tasks.index.create, {
    projectId: f.projectId,
    title: "Private task",
  });
  return { ...f, taskId };
}
test("archive preserves readable content but rejects edits and excludes active reports, while trash hides detail", async () => {
  const f = await fixture();
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskId, status: "done" });
  const commentId = await f.owner.mutation(api.tasks.comments.create, {
    taskId: f.taskId,
    html: "<p>Retained comment</p>",
  });
  const task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: task.updatedAt,
    operation: "archive",
  });
  expect((await f.owner.query(api.tasks.index.list, { projectId: f.projectId, paginationOpts: page })).page).toEqual(
    []
  );
  expect((await f.owner.query(api.tasks.index.get, { taskId: f.taskId })).title).toBe("Private task");
  expect(
    (
      await f.owner.query(api.tasks.comments.list, {
        taskId: f.taskId,
        paginationOpts: { cursor: null, numItems: 50 },
      })
    ).canCreate
  ).toBe(false);
  await expect(f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskId, status: "todo" })).rejects.toThrow();
  const comment = await f.t.run((ctx) => ctx.db.get(commentId));
  await expect(
    f.owner.mutation(api.tasks.comments.update, {
      commentId,
      expectedUpdatedAt: comment!.updatedAt,
      html: "<p>Denied</p>",
    })
  ).rejects.toThrow();
  const report = await f.owner.query(api.reporting.tasks.page, {
    scope: {
      workspaceId: f.workspaceId,
      projectId: f.projectId,
      clientId: null,
      dateFrom: null,
      dateTo: null,
      today: "2026-09-27",
    },
    paginationOpts: page,
  });
  expect(report.contribution.total).toBe(0);
  expect((await f.owner.query(api.reporting.overview.project, { projectId: f.projectId })).recentTasks).toEqual([]);
  const archived = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: archived.updatedAt,
    operation: "delete",
  });
  await expect(f.owner.query(api.tasks.index.resolve, { taskId: f.taskId })).rejects.toThrow();
  await expect(f.owner.query(api.tasks.description.get, { taskId: f.taskId })).rejects.toThrow();
  await expect(
    f.owner.query(api.tasks.comments.list, {
      taskId: f.taskId,
      paginationOpts: { cursor: null, numItems: 50 },
    })
  ).rejects.toThrow();
  const deleted = await f.owner.query(api.tasks.lifecycle.get, {
    taskId: f.taskId,
    view: "deleted",
  });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: deleted.updatedAt,
    operation: "restore",
  });
  expect(
    (await f.owner.query(api.tasks.lifecycle.get, { taskId: f.taskId, view: "archived" })).archivedAt
  ).not.toBeNull();
  expect(
    (
      await f.owner.query(api.tasks.comments.list, {
        taskId: f.taskId,
        paginationOpts: { cursor: null, numItems: 50 },
      })
    ).page[0]._id
  ).toBe(commentId);
});
test("deleted parent/relation is a title-free cleanup placeholder, and removing retained links does not resurrect them", async () => {
  const f = await fixture();
  const parent = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  const childId = await f.owner.mutation(api.tasks.index.create, {
    projectId: f.projectId,
    title: "Child",
    parent: { taskId: f.taskId, expectedUpdatedAt: parent.updatedAt },
  });
  const otherId = await f.owner.mutation(api.tasks.index.create, {
    projectId: f.projectId,
    title: "Other",
  });
  const [updated, other] = await Promise.all([
    f.owner.query(api.tasks.index.get, { taskId: f.taskId }),
    f.owner.query(api.tasks.index.get, { taskId: otherId }),
  ]);
  await f.owner.mutation(api.tasks.relationships.add, {
    taskId: otherId,
    relatedTaskId: f.taskId,
    expectedUpdatedAt: other.updatedAt,
    expectedRelatedUpdatedAt: updated.updatedAt,
    kind: "relates_to",
  });
  const current = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: current.updatedAt,
    operation: "delete",
  });
  expect(await f.owner.query(api.tasks.hierarchy.parent, { taskId: childId })).toEqual({
    task: null,
    hasParent: true,
  });
  const relationships = await f.owner.query(api.tasks.relationships.list, { taskId: otherId });
  expect(relationships[0].task).toBeNull();
  expect(relationships[0].unavailable).toBe(true);
  const child = await f.owner.query(api.tasks.index.get, { taskId: childId });
  await f.owner.mutation(api.tasks.hierarchy.setParent, {
    taskId: childId,
    expectedUpdatedAt: child.updatedAt,
    parent: null,
  });
  const latestOther = await f.owner.query(api.tasks.index.get, { taskId: otherId });
  await f.owner.mutation(api.tasks.relationships.remove, {
    taskId: otherId,
    relationId: relationships[0].relation._id,
    expectedUpdatedAt: latestOther.updatedAt,
  });
  const trash = await f.owner.query(api.tasks.lifecycle.get, { taskId: f.taskId, view: "deleted" });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: trash.updatedAt,
    operation: "restore",
  });
  expect(await f.owner.query(api.tasks.hierarchy.parent, { taskId: childId })).toEqual({
    task: null,
    hasParent: false,
  });
  expect(await f.owner.query(api.tasks.relationships.list, { taskId: otherId })).toEqual([]);
});
test("stale revisions fail and guest creators recover under current access", async () => {
  const f = await fixture();
  const original = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  vi.useFakeTimers();
  vi.setSystemTime(original.updatedAt);
  try {
    await f.owner.mutation(api.tasks.lifecycle.change, {
      taskId: f.taskId,
      expectedUpdatedAt: original.updatedAt,
      operation: "delete",
    });
    await expect(
      f.owner.mutation(api.tasks.lifecycle.change, {
        taskId: f.taskId,
        expectedUpdatedAt: original.updatedAt,
        operation: "restore",
      })
    ).rejects.toThrow("changed");
    const deleted = await f.owner.query(api.tasks.lifecycle.get, {
      taskId: f.taskId,
      view: "deleted",
    });
    expect(deleted.updatedAt).toBe(original.updatedAt + 1);
  } finally {
    vi.useRealTimers();
  }
  const guestId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Guest creator" }));
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: guestId,
    role: "guest",
  });
  await f.owner.mutation(api.projects.index.grantMember, {
    projectId: f.projectId,
    userId: guestId,
    role: "guest",
  });
  await f.t.run((ctx) => ctx.db.patch(f.taskId, { createdBy: guestId }));
  const guest = await signedIn(f.t, guestId);
  const row = await guest.query(api.tasks.lifecycle.get, { taskId: f.taskId, view: "deleted" });
  await guest.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: row.updatedAt,
    operation: "restore",
  });
  await f.owner.mutation(api.projects.index.revokeMember, {
    projectId: f.projectId,
    userId: guestId,
  });
  const restored = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await expect(
    guest.mutation(api.tasks.lifecycle.change, {
      taskId: f.taskId,
      expectedUpdatedAt: restored.updatedAt,
      operation: "delete",
    })
  ).rejects.toThrow("access");
});
test("deletion suppresses recipient notification content and stale assistant actions without deleting history", async () => {
  const f = await fixture();
  const recipientId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Recipient" }));
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: recipientId,
    role: "member",
  });
  await f.owner.mutation(api.projects.index.grantMember, {
    projectId: f.projectId,
    userId: recipientId,
    role: "member",
  });
  const recipient = await signedIn(f.t, recipientId);
  await recipient.mutation(api.notifications.index.subscribe, {
    taskId: f.taskId,
    subscribed: true,
  });
  const conversationId = await f.owner.mutation(api.assistant.index.save, {
    workspaceId: f.workspaceId,
    title: "Review",
    context: { projectId: f.projectId, clientId: null, meetingId: null, documentIds: [] },
  });
  const actionId = await f.owner.mutation(api.assistant.actions.propose, {
    conversationId,
    taskId: f.taskId,
    nextStatus: "done",
  });
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskId, status: "in_progress" });
  const notificationArgs = {
    workspaceId: f.workspaceId,
    view: "inbox" as const,
    unreadOnly: false,
    now: Date.now(),
    paginationOpts: page,
  };
  expect((await recipient.query(api.notifications.index.list, notificationArgs)).page).toHaveLength(1);
  const current = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: current.updatedAt,
    operation: "delete",
  });
  expect((await recipient.query(api.notifications.index.list, notificationArgs)).page).toEqual([]);
  expect((await f.owner.query(api.assistant.actions.list, { conversationId, paginationOpts: page })).page).toEqual([]);
  await expect(f.owner.query(api.assistant.actions.get, { actionId })).rejects.toThrow();
  await expect(f.owner.mutation(api.assistant.actions.confirm, { actionId })).rejects.toThrow();
  const deleted = await f.owner.query(api.tasks.lifecycle.get, {
    taskId: f.taskId,
    view: "deleted",
  });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: deleted.updatedAt,
    operation: "restore",
  });
  expect((await recipient.query(api.notifications.index.list, notificationArgs)).page.length).toBeGreaterThan(0);
  await expect(f.owner.mutation(api.assistant.actions.confirm, { actionId })).rejects.toThrow("changed");
});
test("cycle/module links survive trash while meeting writers can unlink a hidden task without leaking its title", async () => {
  const f = await fixture();
  const cycleId = await f.owner.mutation(api.cycles.index.create, {
    projectId: f.projectId,
    name: "Cycle",
    description: "",
    startDate: null,
    endDate: null,
  });
  const moduleId = await f.owner.mutation(api.modules.index.create, {
    projectId: f.projectId,
    name: "Module",
    descriptionHtml: "",
    startDate: null,
    targetDate: null,
    status: "backlog",
    leadId: null,
  });
  const task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  const cycle = await f.owner.query(api.cycles.index.get, { cycleId, now: Date.now() });
  await f.owner.mutation(api.cycles.tasks.assign, {
    cycleId,
    taskId: f.taskId,
    expectedTaskUpdatedAt: task.updatedAt,
    expectedCycleUpdatedAt: cycle.updatedAt,
  });
  const current = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  const module = await f.owner.query(api.modules.index.get, { moduleId });
  await f.owner.mutation(api.modules.tasks.set, {
    moduleId,
    taskId: f.taskId,
    assigned: true,
    expectedTaskUpdatedAt: current.updatedAt,
    expectedModuleUpdatedAt: module.updatedAt,
  });
  const meetingId = await f.owner.mutation(api.meetings.index.save, {
    workspaceId: f.workspaceId,
    data: {
      title: "Review",
      agenda: "",
      notes: "",
      location: "",
      meetingUrl: "",
      status: "scheduled",
      startsAt: Date.UTC(2026, 8, 27, 10),
      endsAt: Date.UTC(2026, 8, 27, 11),
      projectId: f.projectId,
      summaryDocumentId: null,
    },
    participantIds: [],
  });
  await f.owner.mutation(api.meetings.tasks.link, {
    workspaceId: f.workspaceId,
    meetingId,
    taskId: f.taskId,
  });
  const latest = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: latest.updatedAt,
    operation: "delete",
  });
  expect((await f.owner.query(api.cycles.tasks.list, { cycleId, paginationOpts: page })).page[0]).toMatchObject({
    task: null,
    unavailable: true,
    taskId: f.taskId,
  });
  const hiddenModuleTask = (await f.owner.query(api.modules.tasks.list, { moduleId, paginationOpts: page })).page[0];
  expect(hiddenModuleTask).toMatchObject({ task: null, unavailable: true, taskId: f.taskId });
  await f.owner.mutation(api.modules.tasks.set, {
    moduleId,
    taskId: f.taskId,
    assigned: false,
    expectedTaskUpdatedAt: hiddenModuleTask.updatedAt,
    expectedModuleUpdatedAt: module.updatedAt,
  });
  const links = await f.owner.query(api.meetings.tasks.list, {
    workspaceId: f.workspaceId,
    meetingId,
    paginationOpts: page,
  });
  expect(links.page[0]).toEqual({ linkId: expect.any(String), task: null, unavailable: true });
  await f.owner.mutation(api.meetings.tasks.unlink, {
    workspaceId: f.workspaceId,
    meetingId,
    linkId: links.page[0].linkId,
  });
  const trash = await f.owner.query(api.tasks.lifecycle.get, { taskId: f.taskId, view: "deleted" });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: trash.updatedAt,
    operation: "restore",
  });
  expect((await f.owner.query(api.cycles.tasks.list, { cycleId, paginationOpts: page })).page[0].taskId).toBe(f.taskId);
  expect((await f.owner.query(api.modules.tasks.list, { moduleId, paginationOpts: page })).page).toEqual([]);
  expect(
    (
      await f.owner.query(api.meetings.tasks.list, {
        workspaceId: f.workspaceId,
        meetingId,
        paginationOpts: page,
      })
    ).page
  ).toEqual([]);
});
test("a noncreator project writer can detach a trashed cycle task without access to its trash content", async () => {
  const f = await fixture();
  const cycleId = await f.owner.mutation(api.cycles.index.create, {
    projectId: f.projectId,
    name: "Open cycle",
    description: "",
    startDate: null,
    endDate: null,
  });
  const cycle = await f.owner.query(api.cycles.index.get, { cycleId, now: Date.now() });
  const task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.cycles.tasks.assign, {
    cycleId,
    taskId: f.taskId,
    expectedTaskUpdatedAt: task.updatedAt,
    expectedCycleUpdatedAt: cycle.updatedAt,
  });
  const assigned = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: assigned.updatedAt,
    operation: "delete",
  });
  const writerId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Writer" }));
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: writerId,
    role: "member",
  });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId: writerId, role: "member" });
  const writer = await signedIn(f.t, writerId);
  await expect(writer.query(api.tasks.lifecycle.get, { taskId: f.taskId, view: "deleted" })).rejects.toThrow("creator");
  const hidden = (await writer.query(api.cycles.tasks.list, { cycleId, paginationOpts: page })).page[0];
  expect(hidden.task).toBeNull();
  await writer.mutation(api.cycles.tasks.remove, {
    cycleId,
    taskId: hidden.taskId,
    expectedTaskUpdatedAt: hidden.updatedAt,
    expectedCycleUpdatedAt: cycle.updatedAt,
  });
  expect((await writer.query(api.cycles.tasks.list, { cycleId, paginationOpts: page })).page).toEqual([]);
  const trash = await f.owner.query(api.tasks.lifecycle.get, { taskId: f.taskId, view: "deleted" });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: trash.updatedAt,
    operation: "restore",
  });
  expect(await f.owner.query(api.cycles.tasks.current, { taskId: f.taskId })).toBeNull();
});
