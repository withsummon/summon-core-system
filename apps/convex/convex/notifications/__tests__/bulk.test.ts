import { signedIn } from "../../../test-support/session";
import { expect, test, vi } from "vitest";
import { api, internal } from "../../_generated/api";
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
test("category OR uses current assignee/creator/subscriber state and preserves sparse cursor", async () => {
  const f = await fixture();
  await f.reader.mutation(api.notifications.index.subscribe, { taskId: f.taskId, subscribed: true });
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskId, status: "done" });
  expect(
    (await f.reader.query(api.notifications.index.list, { ...f.page, categories: ["subscribed"] })).page
  ).toHaveLength(1);
  await f.t.run((ctx) => ctx.db.patch(f.taskId, { assigneeIds: [f.userId] }));
  expect(
    (await f.reader.query(api.notifications.index.list, { ...f.page, categories: ["subscribed"] })).page
  ).toHaveLength(0);
  expect(
    (await f.reader.query(api.notifications.index.list, { ...f.page, categories: ["subscribed", "assigned"] })).page
  ).toHaveLength(1);
  await f.reader.mutation(api.notifications.index.subscribe, { taskId: f.taskId, subscribed: false });
  expect(
    (await f.reader.query(api.notifications.index.list, { ...f.page, categories: ["assigned"] })).page
  ).toHaveLength(1);
});
test("bounded read batch excludes new arrivals, is receiver-owned and stops after cancellation", async () => {
  const f = await fixture();
  await f.reader.mutation(api.notifications.index.subscribe, { taskId: f.taskId, subscribed: true });
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskId, status: "done" });
  const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 10000);
  try {
    const batchId = await f.reader.mutation(api.notifications.bulk.begin, {
      workspaceId: f.workspaceId,
      view: "inbox",
    });
    await expect(f.owner.mutation(api.notifications.bulk.page, { batchId })).rejects.toThrow("not found");
    clock.mockReturnValue(Date.now() + 1);
    await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskId, status: "todo" });
    const first = await f.reader.mutation(api.notifications.bulk.page, { batchId });
    expect(first).toEqual({ isDone: true, changed: 1 });
    expect(await f.reader.mutation(api.notifications.bulk.page, { batchId })).toEqual({ isDone: true, changed: 0 });
    const cancelled = await f.reader.mutation(api.notifications.bulk.begin, {
      workspaceId: f.workspaceId,
      view: "inbox",
    });
    await f.reader.mutation(api.notifications.bulk.cancel, { batchId: cancelled });
    expect(await f.reader.mutation(api.notifications.bulk.page, { batchId: cancelled })).toEqual({
      isDone: true,
      changed: 0,
    });
    expect(
      (
        await f.reader.query(api.notifications.index.list, {
          ...f.page,
          unreadOnly: true,
          paginationOpts: { numItems: 100, cursor: null },
        })
      ).page
    ).toHaveLength(1);
  } finally {
    clock.mockRestore();
  }
});
test("a batch rechecks project access and retains unread revoked rows", async () => {
  const f = await fixture();
  await f.reader.mutation(api.notifications.index.subscribe, { taskId: f.taskId, subscribed: true });
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskId, status: "done" });
  const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 10000);
  try {
    const batchId = await f.reader.mutation(api.notifications.bulk.begin, {
      workspaceId: f.workspaceId,
      view: "inbox",
    });
    await f.t.run((ctx) => ctx.db.patch(f.memberId, { active: false }));
    expect(await f.reader.mutation(api.notifications.bulk.page, { batchId })).toEqual({ isDone: true, changed: 0 });
    expect((await f.t.run((ctx) => ctx.db.query("notifications").first()))?.readAt).toBeNull();
  } finally {
    clock.mockRestore();
  }
});
test("read pages traverse beyond 50 candidates and share mention/archive filters", async () => {
  const f = await fixture();
  await f.reader.mutation(api.notifications.index.subscribe, { taskId: f.taskId, subscribed: true });
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskId, status: "done" });
  await f.t.run(async (ctx) => {
    const original = await ctx.db.query("notifications").first();
    if (!original) throw new Error("Fixture notification missing");
    const { _id, _creationTime, ...fields } = original;
    await Promise.all(
      Array.from({ length: 55 }, () => ctx.db.insert("notifications", { ...fields, isMention: true, archivedAt: 1 }))
    );
  });
  const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 10000);
  try {
    const batchId = await f.reader.mutation(api.notifications.bulk.begin, {
      workspaceId: f.workspaceId,
      view: "archived",
      mentionsOnly: true,
      categories: ["subscribed"],
    });
    const first = await f.reader.mutation(api.notifications.bulk.page, { batchId });
    expect(first.isDone).toBe(false);
    let total = first.changed,
      done = false;
    for (let i = 0; i < 5 && !done; i++) {
      // Each page advances the server-owned cursor; parallel calls would test a different flow.
      // eslint-disable-next-line no-await-in-loop
      const next = await f.reader.mutation(api.notifications.bulk.page, { batchId });
      total += next.changed;
      done = next.isDone;
    }
    expect(done).toBe(true);
    expect(total).toBe(55);
    expect(
      (
        await f.reader.query(api.notifications.index.list, {
          ...f.page,
          unreadOnly: true,
          paginationOpts: { numItems: 100, cursor: null },
        })
      ).page
    ).toHaveLength(1);
  } finally {
    clock.mockRestore();
  }
});
test("duplicate categories reject at list and begin boundaries without storing a batch", async () => {
  const f = await fixture();
  const categories = ["assigned", "assigned"] as const;
  await expect(
    f.reader.query(api.notifications.index.list, { ...f.page, categories: [...categories] })
  ).rejects.toThrow("distinct");
  await expect(
    f.reader.mutation(api.notifications.bulk.begin, {
      workspaceId: f.workspaceId,
      view: "inbox",
      categories: [...categories],
    })
  ).rejects.toThrow("distinct");
  expect(await f.t.run((ctx) => ctx.db.query("notificationReadBatches").collect())).toHaveLength(0);
});
test("cleanup is bounded, preserves current batches, and completed retries remain idempotent before retention", async () => {
  const f = await fixture();
  const batchId = await f.reader.mutation(api.notifications.bulk.begin, { workspaceId: f.workspaceId, view: "inbox" });
  await f.reader.mutation(api.notifications.bulk.cancel, { batchId });
  await f.t.run(async (ctx) => {
    const row = await ctx.db.get(batchId);
    if (!row) throw new Error("Missing batch fixture");
    const { _id, _creationTime, ...fields } = row;
    await Promise.all(
      Array.from({ length: 101 }, () =>
        ctx.db.insert("notificationReadBatches", { ...fields, now: Date.now() - 25 * 60 * 60_000 })
      )
    );
  });
  expect(await f.t.mutation(internal.notifications.cleanup.expire, {})).toBe(100);
  expect(await f.t.run((ctx) => ctx.db.query("notificationReadBatches").collect())).toHaveLength(2);
  expect(await f.reader.mutation(api.notifications.bulk.page, { batchId })).toEqual({ isDone: true, changed: 0 });
  expect(await f.t.mutation(internal.notifications.cleanup.expire, {})).toBe(1);
  expect(await f.t.run((ctx) => ctx.db.get(batchId))).not.toBeNull();
});
