import { expect, test } from "vitest";
import { api, internal } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
import { initializeProjectOrder, projectUserProperty } from "../order_owner";
const paginationOpts = { cursor: null, numItems: 100 };
async function projects() {
  const f = await workspaceJourney();
  const second = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Second",
    identifier: "SEC",
  });
  const third = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Third",
    identifier: "THR",
  });
  return { ...f, second, third };
}
test("new projects prepend and adjacent swaps validate both captured revisions and actual neighbor", async () => {
  const f = await projects();
  const before = await f.owner.query(api.projects.order.list, { workspaceId: f.workspaceId, paginationOpts });
  expect(before.page.map((p) => p._id)).toEqual([f.third, f.second, f.projectId]);
  await f.owner.mutation(api.projects.order.move, {
    projectId: f.third,
    neighborId: f.second,
    direction: "down",
    expectedRevision: 0,
    expectedNeighborRevision: 0,
  });
  expect(
    (await f.owner.query(api.projects.order.list, { workspaceId: f.workspaceId, paginationOpts })).page.map(
      (p) => p._id
    )
  ).toEqual([f.second, f.third, f.projectId]);
  await expect(
    f.owner.mutation(api.projects.order.move, {
      projectId: f.projectId,
      neighborId: f.third,
      direction: "up",
      expectedRevision: 0,
      expectedNeighborRevision: 0,
    })
  ).rejects.toThrow("Neighboring");
  await expect(
    f.owner.mutation(api.projects.order.move, {
      projectId: f.second,
      neighborId: f.third,
      direction: "up",
      expectedRevision: 1,
      expectedNeighborRevision: 1,
    })
  ).rejects.toThrow("boundary");
  await expect(
    f.owner.mutation(api.projects.order.move, {
      projectId: f.projectId,
      neighborId: f.second,
      direction: "up",
      expectedRevision: 0,
      expectedNeighborRevision: 1,
    })
  ).rejects.toThrow("Neighboring");
});
test("guest ordering is personal, current membership gated, and revoke/rejoin retains its position", async () => {
  const f = await projects();
  const userId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Guest" }));
  const guest = await signedIn(f.t, userId);
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role: "guest" });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId, role: "guest" });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.second, userId, role: "guest" });
  await guest.mutation(api.projects.order.move, {
    projectId: f.second,
    neighborId: f.projectId,
    direction: "down",
    expectedRevision: 0,
    expectedNeighborRevision: 0,
  });
  expect(
    (await guest.query(api.projects.order.list, { workspaceId: f.workspaceId, paginationOpts })).page.map((p) => p._id)
  ).toEqual([f.projectId, f.second]);
  expect(
    (await f.owner.query(api.projects.order.list, { workspaceId: f.workspaceId, paginationOpts })).page.map(
      (p) => p._id
    )
  ).toEqual([f.third, f.second, f.projectId]);
  await f.owner.mutation(api.projects.index.revokeMember, { projectId: f.projectId, userId });
  await expect(
    guest.mutation(api.projects.order.move, {
      projectId: f.projectId,
      neighborId: f.second,
      direction: "down",
      expectedRevision: 1,
      expectedNeighborRevision: 1,
    })
  ).rejects.toThrow();
  expect(
    (await guest.query(api.projects.order.list, { workspaceId: f.workspaceId, paginationOpts })).page.map((p) => p._id)
  ).toEqual([f.second]);
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId, role: "guest" });
  expect(
    (await guest.query(api.projects.order.list, { workspaceId: f.workspaceId, paginationOpts })).page.map((p) => p._id)
  ).toEqual([f.projectId, f.second]);
  await f.owner.mutation(api.workspaces.index.revokeMember, { workspaceId: f.workspaceId, userId });
  await expect(guest.query(api.projects.order.list, { workspaceId: f.workspaceId, paginationOpts })).rejects.toThrow();
});
test("archived projects produce sparse pages, retain cursors and are skipped by authorized neighbor search", async () => {
  const f = await projects();
  await f.t.run((ctx) => ctx.db.patch(f.second, { archived: true }));
  const first = await f.owner.query(api.projects.order.list, {
    workspaceId: f.workspaceId,
    paginationOpts: { cursor: null, numItems: 1 },
  });
  const sparse = await f.owner.query(api.projects.order.list, {
    workspaceId: f.workspaceId,
    paginationOpts: { cursor: first.continueCursor, numItems: 1 },
  });
  expect(sparse.page).toEqual([]);
  expect(sparse.isDone).toBe(false);
  await f.owner.mutation(api.projects.order.move, {
    projectId: f.third,
    neighborId: f.projectId,
    direction: "down",
    expectedRevision: 0,
    expectedNeighborRevision: 0,
  });
  await f.t.run((ctx) => ctx.db.patch(f.second, { archived: false }));
  expect(
    (await f.owner.query(api.projects.order.list, { workspaceId: f.workspaceId, paginationOpts })).page.map(
      (p) => p._id
    )
  ).toEqual([f.projectId, f.second, f.third]);
});
test("bounded backfill initializes older active/inactive memberships once without changing current project list", async () => {
  const f = await projects();
  await f.t.run(async (ctx) => {
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", f.third).eq("userId", f.userId))
      .unique();
    await ctx.db.patch(membership!._id, { active: false });
    const rows = await ctx.db.query("projectUserProperties").collect();
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
  });
  expect((await f.owner.query(api.projects.index.list, { workspaceId: f.workspaceId })).length).toBe(2);
  expect(await f.t.mutation(internal.projects.order.backfill, { cursor: null })).toMatchObject({
    changed: 3,
    processed: 3,
    isDone: true,
  });
  const before = await f.owner.query(api.projects.order.list, { workspaceId: f.workspaceId, paginationOpts });
  expect(await f.t.mutation(internal.projects.order.backfill, { cursor: null })).toMatchObject({
    changed: 0,
    processed: 3,
    isDone: true,
  });
  expect(await f.owner.query(api.projects.order.list, { workspaceId: f.workspaceId, paginationOpts })).toEqual(before);
});
test("numeric exhaustion rolls back creation, duplicate positions reject moves, repeated initialization stays unique", async () => {
  const f = await projects();
  await f.t.run(async (ctx) => {
    const row = await projectUserProperty(ctx, f.third, f.userId);
    await ctx.db.patch(row!._id, { sortOrder: Number.MIN_SAFE_INTEGER });
  });
  await expect(
    f.owner.mutation(api.projects.index.create, { workspaceId: f.workspaceId, name: "Overflow", identifier: "OVER" })
  ).rejects.toThrow("numeric limit");
  expect((await f.owner.query(api.projects.index.list, { workspaceId: f.workspaceId })).length).toBe(3);
  await f.t.run(async (ctx) => {
    const a = await projectUserProperty(ctx, f.projectId, f.userId),
      b = await projectUserProperty(ctx, f.second, f.userId);
    await ctx.db.patch(a!._id, { sortOrder: b!.sortOrder });
    expect(
      await initializeProjectOrder(ctx, { workspaceId: f.workspaceId, projectId: f.projectId, userId: f.userId })
    ).toBe(false);
  });
  await expect(
    f.owner.mutation(api.projects.order.move, {
      projectId: f.projectId,
      neighborId: f.third,
      direction: "up",
      expectedRevision: 0,
      expectedNeighborRevision: 0,
    })
  ).rejects.toThrow("inconsistent");
});

test("concurrent canonical creation allocates distinct integer positions", async () => {
  const f = await workspaceJourney();
  await Promise.all(
    ["ALPHA", "BETA"].map((identifier) =>
      f.owner.mutation(api.projects.index.create, { workspaceId: f.workspaceId, name: identifier, identifier })
    )
  );
  const rows = await f.t.run((ctx) => ctx.db.query("projectUserProperties").collect());
  expect(new Set(rows.map((row) => row.sortOrder)).size).toBe(3);
  expect(rows.every((row) => Number.isSafeInteger(row.sortOrder))).toBe(true);
});
test("neighbor scanning reports explicit overflow instead of falsely claiming a boundary", async () => {
  const f = await projects();
  await f.t.run(async (ctx) => {
    const base = await ctx.db.get(f.projectId);
    const { _id, _creationTime, ...data } = base!;
    await Promise.all(
      Array.from({ length: 201 }, async (_, i) => {
        const projectId = await ctx.db.insert("projects", { ...data, identifier: `HIDDEN${i}` });
        await ctx.db.insert("projectUserProperties", {
          projectId,
          workspaceId: f.workspaceId,
          userId: f.userId,
          sortOrder: 45536 + i,
          revision: 0,
        });
      })
    );
  });
  await expect(
    f.owner.mutation(api.projects.order.move, {
      projectId: f.third,
      neighborId: f.second,
      direction: "down",
      expectedRevision: 0,
      expectedNeighborRevision: 0,
    })
  ).rejects.toThrow("Too many unavailable");
  expect((await f.t.run((ctx) => projectUserProperty(ctx, f.third, f.userId)))?.revision).toBe(0);
});
