import { signedIn } from "../../../test-support/session";
import { recordTaskEvent } from "../delivery";
import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
async function fixture() {
  const base = await workspaceJourney();
  const taskId = await base.owner.mutation(api.tasks.index.create, { projectId: base.projectId, title: "Delivery" });
  const other = await base.t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Reader" });
    await ctx.db.insert("workspaceMembers", { workspaceId: base.workspaceId, userId, role: "member", active: true });
    const memberId = await ctx.db.insert("projectMembers", {
      workspaceId: base.workspaceId,
      projectId: base.projectId,
      userId,
      role: "member",
      active: true,
    });
    return { userId, memberId };
  });
  const reader = await signedIn(base.t, other.userId);
  const page = {
    workspaceId: base.workspaceId,
    view: "inbox" as const,
    unreadOnly: false,
    now: Date.now(),
    paginationOpts: { numItems: 20, cursor: null },
  };
  return { ...base, ...other, taskId, reader, page };
}
test("subscribing twice delivers once, excludes actor and status no-op, unsubscribe stops delivery", async () => {
  const f = await fixture();
  await f.reader.mutation(api.notifications.index.subscribe, { taskId: f.taskId, subscribed: true });
  await f.reader.mutation(api.notifications.index.subscribe, { taskId: f.taskId, subscribed: true });
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskId, status: "done" });
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskId, status: "done" });
  expect((await f.reader.query(api.notifications.index.list, f.page)).page).toHaveLength(1);
  expect((await f.owner.query(api.notifications.index.list, f.page)).page).toHaveLength(0);
  await f.reader.mutation(api.notifications.index.subscribe, { taskId: f.taskId, subscribed: false });
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskId, status: "todo" });
  expect((await f.reader.query(api.notifications.index.list, f.page)).page).toHaveLength(1);
});
test("recipient states preserve snooze expiry and archive precedence without allowing another receiver", async () => {
  const f = await fixture();
  await f.reader.mutation(api.notifications.index.subscribe, { taskId: f.taskId, subscribed: true });
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskId, status: "done" });
  const [row] = (await f.reader.query(api.notifications.index.list, f.page)).page;
  await expect(
    f.owner.mutation(api.notifications.index.update, { notificationId: row._id, change: { kind: "read", value: true } })
  ).rejects.toThrow("not found");
  await f.reader.mutation(api.notifications.index.update, {
    notificationId: row._id,
    change: { kind: "read", value: true },
  });
  expect((await f.reader.query(api.notifications.index.list, { ...f.page, unreadOnly: true })).page).toHaveLength(0);
  await f.reader.mutation(api.notifications.index.update, {
    notificationId: row._id,
    change: { kind: "read", value: false },
  });
  const until = Date.now() + 60000;
  await f.reader.mutation(api.notifications.index.update, {
    notificationId: row._id,
    change: { kind: "snooze", until },
  });
  expect((await f.reader.query(api.notifications.index.list, f.page)).page).toHaveLength(0);
  expect((await f.reader.query(api.notifications.index.list, { ...f.page, view: "snoozed" })).page).toHaveLength(1);
  expect((await f.reader.query(api.notifications.index.list, { ...f.page, now: until })).page).toHaveLength(1);
  await f.reader.mutation(api.notifications.index.update, {
    notificationId: row._id,
    change: { kind: "archive", value: true },
  });
  expect((await f.reader.query(api.notifications.index.list, { ...f.page, view: "snoozed" })).page).toHaveLength(0);
  expect((await f.reader.query(api.notifications.index.list, { ...f.page, view: "archived" })).page).toHaveLength(1);
});
test("revocation hides existing records, denies mutation, and prevents future delivery", async () => {
  const f = await fixture();
  await f.reader.mutation(api.notifications.index.subscribe, { taskId: f.taskId, subscribed: true });
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskId, status: "done" });
  const [row] = (await f.reader.query(api.notifications.index.list, f.page)).page;
  await f.t.run((ctx) => ctx.db.patch(f.memberId, { active: false }));
  expect((await f.reader.query(api.notifications.index.list, f.page)).page).toHaveLength(0);
  await expect(
    f.reader.mutation(api.notifications.index.update, {
      notificationId: row._id,
      change: { kind: "read", value: true },
    })
  ).rejects.toThrow("access");
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskId, status: "todo" });
  expect(await f.t.run((ctx) => ctx.db.query("notifications").collect())).toHaveLength(1);
});
test("filtered empty pages retain cursor and invalid budgets reject", async () => {
  const f = await fixture();
  await f.reader.mutation(api.notifications.index.subscribe, { taskId: f.taskId, subscribed: true });
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskId, status: "done" });
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskId, status: "todo" });
  const page = await f.reader.query(api.notifications.index.list, {
    ...f.page,
    view: "archived",
    paginationOpts: { numItems: 1, cursor: null },
  });
  expect(page.page).toHaveLength(0);
  expect(page.isDone).toBe(false);
  expect(page.continueCursor).toBeTruthy();
  await Promise.all(
    [0, 101, 1.5].map(async (numItems) =>
      expect(
        f.reader.query(api.notifications.index.list, { ...f.page, paginationOpts: { numItems, cursor: null } })
      ).rejects.toThrow("Invalid")
    )
  );
  await expect(f.t.query(api.notifications.index.list, f.page)).rejects.toThrow("Sign in");
});
test("subscriber cap rejects excess instead of silently dropping delivery, failed task writes emit nothing", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    await Promise.all(
      Array.from({ length: 99 }, async (_, i) => {
        const userId = await ctx.db.insert("users", { name: `Subscriber ${i}` });
        await ctx.db.insert("taskSubscriptions", { taskId: f.taskId, userId });
      })
    );
  });
  await expect(
    f.reader.mutation(api.notifications.index.subscribe, { taskId: f.taskId, subscribed: true })
  ).rejects.toThrow("100 subscriber");
  const task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await expect(
    f.owner.mutation(api.tasks.index.update, {
      taskId: f.taskId,
      expectedUpdatedAt: task.updatedAt - 1,
      title: "Stale",
      description: task.description,
      status: "done",
      priority: task.priority,
      estimatePointId: task.estimatePointId,
      assigneeIds: task.assigneeIds,
      labelIds: task.labelIds,
      startDate: task.startDate,
      targetDate: task.targetDate,
      stateId: task.stateId,
    })
  ).rejects.toThrow("changed");
  expect(await f.t.run((ctx) => ctx.db.query("notifications").collect())).toHaveLength(0);
  expect((await f.owner.query(api.tasks.index.get, { taskId: f.taskId })).status).toBe("todo");
});

test("event owner rejects mismatched or missing tasks without orphan events", async () => {
  const f = await fixture();
  const before = await f.t.run((ctx) => ctx.db.query("taskEvents").collect());
  const wrongWorkspace = await f.t.run((ctx) =>
    ctx.db.insert("workspaces", { name: "Other", slug: "other-event-scope", metadataRevision: 0 })
  );
  const event = {
    taskId: f.taskId,
    workspaceId: wrongWorkspace,
    projectId: f.projectId,
    actorId: f.userId,
    kind: "updated" as const,
    status: "todo" as const,
  };
  await expect(f.t.run((ctx) => recordTaskEvent(ctx, event))).rejects.toThrow("scope");
  await f.t.run((ctx) => ctx.db.delete(f.taskId));
  await expect(f.t.run((ctx) => recordTaskEvent(ctx, { ...event, workspaceId: f.workspaceId }))).rejects.toThrow(
    "scope"
  );
  expect(await f.t.run((ctx) => ctx.db.query("taskEvents").collect())).toEqual(before);
});
