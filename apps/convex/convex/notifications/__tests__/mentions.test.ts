import { signedIn } from "../../../test-support/session";
import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
const paginationOpts = { cursor: null, numItems: 100 };
async function fixture() {
  const f = await workspaceJourney();
  const taskId = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Mentions" });
  const userId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Recipient" }));
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role: "member" });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId, role: "member" });
  return { ...f, taskId, recipientId: userId, recipient: await signedIn(f.t, userId) };
}
test("new mention sends one notification and subscribes recipient, later edit remains ordinary notification, remention notifies once", async () => {
  const f = await fixture();
  const commentId = await f.owner.mutation(api.tasks.comments.create, {
    taskId: f.taskId,
    html: "<p>Hello</p>",
    mentionedUserIds: [f.recipientId, f.userId],
  });
  expect(await f.recipient.query(api.notifications.index.subscription, { taskId: f.taskId })).toBe(true);
  let rows = await f.t.run((ctx) => ctx.db.query("notifications").collect());
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ receiverId: f.recipientId, isMention: true });
  let comment = await f.owner.query(api.tasks.comments.get, { taskId: f.taskId, commentId });
  await f.owner.mutation(api.tasks.comments.update, {
    commentId,
    expectedUpdatedAt: comment.updatedAt,
    html: "<p>Edited</p>",
    mentionedUserIds: [f.recipientId],
  });
  rows = await f.t.run((ctx) => ctx.db.query("notifications").collect());
  expect(rows).toHaveLength(2);
  expect(rows[1].isMention).toBe(false);
  comment = await f.owner.query(api.tasks.comments.get, { taskId: f.taskId, commentId });
  await f.owner.mutation(api.tasks.comments.update, {
    commentId,
    expectedUpdatedAt: comment.updatedAt,
    html: comment.html,
    mentionedUserIds: [],
  });
  comment = await f.owner.query(api.tasks.comments.get, { taskId: f.taskId, commentId });
  await f.owner.mutation(api.tasks.comments.update, {
    commentId,
    expectedUpdatedAt: comment.updatedAt,
    html: comment.html,
    mentionedUserIds: [f.recipientId],
  });
  const inbox = await f.recipient.query(api.notifications.index.list, {
    workspaceId: f.workspaceId,
    view: "inbox",
    unreadOnly: false,
    mentionsOnly: true,
    now: Date.now(),
    paginationOpts,
  });
  expect(inbox.page).toHaveLength(2);
  expect(inbox.page.every((row) => row.isMention)).toBe(true);
});
test("revoked or ineligible guest mentions fail atomically, directory excludes them; comment resolver binds task and hides removed content", async () => {
  const f = await fixture();
  await f.owner.mutation(api.projects.index.grantMember, {
    projectId: f.projectId,
    userId: f.recipientId,
    role: "guest",
  });
  expect(
    (await f.owner.query(api.notifications.mentions.choices, { taskId: f.taskId, paginationOpts })).page.some(
      (row) => row.id === f.recipientId
    )
  ).toBe(false);
  await expect(
    f.owner.mutation(api.tasks.comments.create, {
      taskId: f.taskId,
      html: "<p>Invalid</p>",
      mentionedUserIds: [f.recipientId],
    })
  ).rejects.toThrow("access");
  expect(await f.t.run((ctx) => ctx.db.query("taskComments").collect())).toEqual([]);
  const commentId = await f.owner.mutation(api.tasks.comments.create, { taskId: f.taskId, html: "<p>Valid</p>" });
  const other = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Other" });
  await expect(f.owner.query(api.tasks.comments.get, { taskId: other, commentId })).rejects.toThrow("not found");
  const comment = await f.owner.query(api.tasks.comments.get, { taskId: f.taskId, commentId });
  await f.owner.mutation(api.tasks.comments.remove, { commentId, expectedUpdatedAt: comment.updatedAt });
  await expect(f.owner.query(api.tasks.comments.get, { taskId: f.taskId, commentId })).rejects.toThrow("not found");
});
test("self unsubscribe works after archive without allowing a new subscription", async () => {
  const f = await fixture();
  await f.recipient.mutation(api.notifications.index.subscribe, { taskId: f.taskId, subscribed: true });
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskId, status: "done" });
  const task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: task.updatedAt,
    operation: "archive",
  });
  expect(await f.recipient.query(api.notifications.index.subscriptionAccess, { taskId: f.taskId })).toMatchObject({
    canSubscribe: false,
    canUnsubscribe: true,
  });
  await f.recipient.mutation(api.notifications.index.subscribe, { taskId: f.taskId, subscribed: false });
  await expect(
    f.recipient.mutation(api.notifications.index.subscribe, { taskId: f.taskId, subscribed: true })
  ).rejects.toThrow("not found");
});

test("subscriber capacity failure rolls back comment and mentions, stale comment edit cannot deliver again", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    await Promise.all(
      Array.from({ length: 99 }, async () => {
        const userId = await ctx.db.insert("users", { name: "Existing subscriber" });
        await ctx.db.insert("taskSubscriptions", { taskId: f.taskId, userId });
      })
    );
  });
  await expect(
    f.owner.mutation(api.tasks.comments.create, {
      taskId: f.taskId,
      html: "<p>Atomic</p>",
      mentionedUserIds: [f.recipientId],
    })
  ).rejects.toThrow("subscriber limit");
  expect(await f.t.run((ctx) => ctx.db.query("taskComments").collect())).toEqual([]);
  expect(await f.recipient.query(api.notifications.index.subscription, { taskId: f.taskId })).toBe(false);
  await f.t.run(async (ctx) => {
    const row = await ctx.db
      .query("taskSubscriptions")
      .filter((q) => q.neq(q.field("userId"), f.userId))
      .first();
    if (row) await ctx.db.delete(row._id);
  });
  const commentId = await f.owner.mutation(api.tasks.comments.create, {
    taskId: f.taskId,
    html: "<p>Atomic</p>",
    mentionedUserIds: [f.recipientId],
  });
  const comment = await f.owner.query(api.tasks.comments.get, { taskId: f.taskId, commentId });
  const args = {
    commentId,
    html: "<p>Edit</p>",
    expectedUpdatedAt: comment.updatedAt,
    mentionedUserIds: [f.recipientId],
  };
  await f.owner.mutation(api.tasks.comments.update, args);
  await expect(f.owner.mutation(api.tasks.comments.update, args)).rejects.toThrow("changed");
  expect(
    (await f.t.run((ctx) => ctx.db.query("notifications").collect())).filter((row) => row.receiverId === f.recipientId)
  ).toHaveLength(2);
});
