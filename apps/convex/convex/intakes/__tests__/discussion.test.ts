import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
const paginationOpts = { cursor: null, numItems: 30 };
async function setup() {
  const f = await workspaceJourney();
  await f.owner.mutation(api.intakes.index.configure, {
    projectId: f.projectId,
    expectedRevision: 0,
    enabled: true,
    guestViewAllFeatures: false,
  });
  const guestId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Guest" }));
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: guestId,
    role: "guest",
  });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId: guestId, role: "guest" });
  const guest = await signedIn(f.t, guestId);
  const taskId = await guest.mutation(api.intakes.index.submit, {
    projectId: f.projectId,
    title: "Incoming",
    html: "<p>Text</p>",
    priority: "none",
  });
  const notifications = () =>
    guest.query(api.notifications.index.list, {
      workspaceId: f.workspaceId,
      view: "inbox",
      unreadOnly: false,
      now: Date.now(),
      paginationOpts,
    });
  return { ...f, guestId, guest, taskId, notifications };
}
test("intake comments preserve guest privacy, CAS, reaction identity and ordinary task exclusion", async () => {
  const f = await setup();
  const other = await f.owner.mutation(api.intakes.index.submit, {
    projectId: f.projectId,
    title: "Other",
    html: "",
    priority: "none",
  });
  await expect(f.guest.query(api.tasks.comments.list, { taskId: other, paginationOpts })).rejects.toThrow("not found");
  const commentId = await f.guest.mutation(api.tasks.comments.create, { taskId: f.taskId, html: "<p>Hello</p>" });
  const comment = (await f.guest.query(api.tasks.comments.list, { taskId: f.taskId, paginationOpts })).page[0];
  const target = { taskId: f.taskId, commentId, reaction: "128077", active: true };
  const id = await f.owner.mutation(api.tasks.commentReactions.set, target);
  expect(await f.owner.mutation(api.tasks.commentReactions.set, target)).toBe(id);
  await expect(f.owner.mutation(api.tasks.commentReactions.set, { ...target, taskId: other })).rejects.toThrow(
    "Comment not found"
  );
  await f.guest.mutation(api.tasks.comments.remove, { commentId, expectedUpdatedAt: comment.updatedAt });
  await expect(
    f.guest.mutation(api.tasks.comments.update, {
      commentId,
      expectedUpdatedAt: comment.updatedAt,
      html: "<p>Stale</p>",
    })
  ).rejects.toThrow();
  await expect(
    f.owner.query(api.tasks.commentReactions.list, { taskId: f.taskId, commentId, paginationOpts })
  ).rejects.toThrow("Comment not found");
  const removed = (await f.guest.query(api.tasks.comments.list, { taskId: f.taskId, deleted: true, paginationOpts }))
    .page[0];
  await f.guest.mutation(api.tasks.comments.restore, { commentId, expectedUpdatedAt: removed.updatedAt });
  expect(
    (await f.owner.query(api.tasks.commentReactions.list, { taskId: f.taskId, commentId, paginationOpts })).page
  ).toHaveLength(1);
  await expect(f.guest.query(api.tasks.index.get, { taskId: f.taskId })).rejects.toThrow("not found");
});
test("mentions deliver once, removed intake hides discussion and retained subscriptions, revoked recipient cannot mutate notification", async () => {
  const f = await setup();
  await f.guest.mutation(api.notifications.index.subscribe, { taskId: f.taskId, subscribed: true });
  await f.owner.mutation(api.tasks.comments.create, {
    taskId: f.taskId,
    html: "<p>Review</p>",
    mentionedUserIds: [f.guestId],
  });
  const rows = await f.notifications();
  expect(rows.page).toHaveLength(1);
  expect(rows.page[0]).toMatchObject({ destination: "intake", isMention: true });
  const detail = await f.owner.query(api.intakes.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.intakes.index.remove, {
    taskId: f.taskId,
    expectedUpdatedAt: detail.intake.updatedAt,
    expectedTaskUpdatedAt: detail.task.updatedAt,
  });
  expect((await f.notifications()).page).toEqual([]);
  await expect(f.guest.query(api.tasks.comments.list, { taskId: f.taskId, paginationOpts })).rejects.toThrow(
    "not found"
  );
  await expect(
    f.guest.mutation(api.notifications.index.subscribe, { taskId: f.taskId, subscribed: false })
  ).rejects.toThrow("not found");
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("taskSubscriptions")
        .withIndex("by_task_user", (q) => q.eq("taskId", f.taskId).eq("userId", f.guestId))
        .unique()
    )
  ).not.toBeNull();
  await f.owner.mutation(api.projects.index.revokeMember, { projectId: f.projectId, userId: f.guestId });
  await expect(
    f.guest.mutation(api.notifications.index.update, {
      notificationId: rows.page[0]._id,
      change: { kind: "read", value: true },
    })
  ).rejects.toThrow();
});
test("acceptance preserves comments and subscriptions while notification destinations become ordinary tasks", async () => {
  const f = await setup();
  await f.guest.mutation(api.notifications.index.subscribe, { taskId: f.taskId, subscribed: true });
  const commentId = await f.owner.mutation(api.tasks.comments.create, { taskId: f.taskId, html: "<p>Before</p>" });
  await f.owner.mutation(api.tasks.states.save, {
    projectId: f.projectId,
    data: { name: "Ready", description: "", color: "blue", status: "todo", sortOrder: 0, isDefault: true },
  });
  const detail = await f.owner.query(api.intakes.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.intakes.index.decide, {
    taskId: f.taskId,
    expectedUpdatedAt: detail.intake.updatedAt,
    expectedTaskUpdatedAt: detail.task.updatedAt,
    status: "accepted",
    snoozedUntil: null,
    duplicateTo: null,
  });
  expect((await f.guest.query(api.tasks.comments.list, { taskId: f.taskId, paginationOpts })).page[0]._id).toBe(
    commentId
  );
  expect(await f.guest.query(api.notifications.index.subscription, { taskId: f.taskId })).toBe(true);
  const rows = (await f.notifications()).page;
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every((row) => row.destination === "task")).toBe(true);
  await f.guest.mutation(api.notifications.index.subscribe, { taskId: f.taskId, subscribed: false });
  expect(await f.guest.query(api.notifications.index.subscription, { taskId: f.taskId })).toBe(false);
});
test("guest-view flag admits other guest discussion; inaccessible mention rolls back comment and subscription", async () => {
  const f = await setup();
  const taskId = await f.owner.mutation(api.intakes.index.submit, {
    projectId: f.projectId,
    title: "Review",
    html: "",
    priority: "none",
  });
  const before = await f.t.run((ctx) => ctx.db.query("taskComments").collect());
  await expect(
    f.owner.mutation(api.tasks.comments.create, {
      taskId,
      html: "<p>Hidden mention</p>",
      mentionedUserIds: [f.guestId],
    })
  ).rejects.toThrow("no longer has access");
  expect(await f.t.run((ctx) => ctx.db.query("taskComments").collect())).toEqual(before);
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("taskSubscriptions")
        .withIndex("by_task_user", (q) => q.eq("taskId", taskId).eq("userId", f.guestId))
        .collect()
    )
  ).toEqual([]);
  await f.owner.mutation(api.intakes.index.configure, {
    projectId: f.projectId,
    expectedRevision: 1,
    enabled: true,
    guestViewAllFeatures: true,
  });
  const id = await f.guest.mutation(api.tasks.comments.create, { taskId, html: "<p>Visible now</p>" });
  await f.guest.mutation(api.tasks.reactions.set, { taskId, reaction: "128077", active: true });
  await f.guest.mutation(api.notifications.index.subscribe, { taskId, subscribed: true });
  await f.owner.mutation(api.intakes.index.configure, {
    projectId: f.projectId,
    expectedRevision: 2,
    enabled: true,
    guestViewAllFeatures: false,
  });
  await expect(f.guest.query(api.tasks.comments.get, { taskId, commentId: id })).rejects.toThrow("not found");
  await expect(
    f.guest.mutation(api.tasks.reactions.set, { taskId, reaction: "128077", active: false })
  ).rejects.toThrow("not found");
  await f.owner.mutation(api.tasks.comments.create, { taskId, html: "<p>Private again</p>" });
  expect((await f.notifications()).page).toEqual([]);
});
test("triage property events notify only currently authorized subscribers", async () => {
  const f = await setup();
  await f.guest.mutation(api.notifications.index.subscribe, { taskId: f.taskId, subscribed: true });
  let detail = await f.owner.query(api.intakes.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.intakes.index.edit, {
    taskId: f.taskId,
    expectedUpdatedAt: detail.intake.updatedAt,
    expectedTaskUpdatedAt: detail.task.updatedAt,
    title: "Reviewed title",
    html: "<p>Private description</p>",
    priority: "high",
  });
  const first = await f.notifications();
  expect(first.page).toHaveLength(1);
  expect(first.page[0]).toMatchObject({ destination: "intake", taskTitle: "Reviewed title" });
  expect(JSON.stringify(first.page[0].event)).not.toContain("Private description");
  await f.owner.mutation(api.projects.index.revokeMember, { projectId: f.projectId, userId: f.guestId });
  detail = await f.owner.query(api.intakes.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.intakes.index.edit, {
    taskId: f.taskId,
    expectedUpdatedAt: detail.intake.updatedAt,
    expectedTaskUpdatedAt: detail.task.updatedAt,
    title: "After revocation",
    html: "<p>Other private description</p>",
  });
  const stored = await f.t.run((ctx) =>
    ctx.db
      .query("notifications")
      .withIndex("by_receiver_workspace", (q) => q.eq("receiverId", f.guestId).eq("workspaceId", f.workspaceId))
      .collect()
  );
  expect(stored).toHaveLength(1);
  expect((await f.notifications()).page).toEqual([]);
});
