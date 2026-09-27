import { expect, test, vi } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
async function fixture() {
  const f = await workspaceJourney();
  const viewId = await f.t.run((ctx) =>
    ctx.db.insert("savedViews", {
      workspaceId: f.workspaceId,
      projectId: f.projectId,
      ownerId: f.userId,
      name: "Shared view",
      description: "",
      filters: {
        match: "all",
        statuses: [],
        priorities: [],
        stateIds: [],
        labelIds: [],
        assigneeIds: [],
        creatorIds: [],
        startDate: null,
        targetDate: null,
      },
      isLocked: false,
      deletedAt: null,
      updatedAt: Date.now(),
    })
  );
  const target = { type: "view" as const, id: viewId };
  const state = () => f.owner.query(api.favorites.index.state, { workspaceId: f.workspaceId, target });
  return { ...f, viewId, target, state };
}
test("saved-view flag and collection follow shared folder visibility and Boolean writes preserve one row", async () => {
  const f = await fixture();
  await f.owner.mutation(api.savedViews.favorites.set, { viewId: f.viewId, favorite: true });
  const row = (await f.state()).favorite;
  if (!row) throw new Error("Favorite missing");
  const folder = await f.owner.mutation(api.favorites.index.create, {
    workspaceId: f.workspaceId,
    target: { type: "folder" },
    name: "Folder",
    parentId: null,
  });
  await f.owner.mutation(api.favorites.index.update, {
    favoriteId: row._id,
    expectedUpdatedAt: row.updatedAt,
    name: null,
    parentId: folder,
    sequence: row.sequence,
  });
  const parent = await f.t.run((ctx) => ctx.db.get(folder));
  if (!parent) throw new Error("Folder missing");
  await f.owner.mutation(api.favorites.index.lifecycle, {
    favoriteId: folder,
    expectedUpdatedAt: parent.updatedAt,
    deleted: true,
  });
  expect((await f.state()).isFavorite).toBe(false);
  expect((await f.owner.query(api.savedViews.index.get, { viewId: f.viewId })).isFavorite).toBe(false);
  expect(
    (
      await f.owner.query(api.savedViews.favorites.list, {
        projectId: f.projectId,
        paginationOpts: { cursor: null, numItems: 20 },
      })
    ).page
  ).toHaveLength(0);
  await expect(f.owner.mutation(api.savedViews.favorites.set, { viewId: f.viewId, favorite: true })).rejects.toThrow(
    "parent favorite folder"
  );
  const trashed = await f.t.run((ctx) => ctx.db.get(folder));
  if (!trashed) throw new Error("Folder missing");
  await f.owner.mutation(api.favorites.index.lifecycle, {
    favoriteId: folder,
    expectedUpdatedAt: trashed.updatedAt,
    deleted: false,
  });
  expect((await f.owner.query(api.savedViews.index.get, { viewId: f.viewId })).isFavorite).toBe(true);
  await f.owner.mutation(api.savedViews.favorites.set, { viewId: f.viewId, favorite: false });
  await f.owner.mutation(api.savedViews.favorites.set, { viewId: f.viewId, favorite: true });
  expect((await f.state()).favorite?._id).toBe(row._id);
  expect(await f.t.run((ctx) => ctx.db.query("savedViewFavorites").collect())).toHaveLength(0);
});
test("saved-view project guests cannot bypass write policy through generic lifecycle", async () => {
  const f = await fixture();
  await f.owner.mutation(api.savedViews.favorites.set, { viewId: f.viewId, favorite: true });
  const row = (await f.state()).favorite;
  if (!row) throw new Error("Favorite missing");
  await f.t.run(async (ctx) => {
    const member = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", f.projectId).eq("userId", f.userId))
      .unique();
    if (member) await ctx.db.patch(member._id, { role: "guest" });
  });
  expect((await f.state()).canFavorite).toBe(false);
  await expect(
    f.owner.mutation(api.favorites.index.lifecycle, {
      favoriteId: row._id,
      expectedUpdatedAt: row.updatedAt,
      deleted: true,
    })
  ).rejects.toThrow("unavailable");
});
test("restarring updates chronological favorite order while sidebar sequence remains unchanged", async () => {
  const f = await fixture();
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date("2026-09-27T00:00:00Z"));
    await f.owner.mutation(api.savedViews.favorites.set, { viewId: f.viewId, favorite: true });
    const first = (await f.state()).favorite;
    await f.owner.mutation(api.savedViews.favorites.set, { viewId: f.viewId, favorite: false });
    vi.setSystemTime(new Date("2026-09-27T00:01:00Z"));
    await f.owner.mutation(api.savedViews.favorites.set, { viewId: f.viewId, favorite: true });
    const restored = (await f.state()).favorite;
    expect(restored?.favoritedAt).toBeGreaterThan(first?.favoritedAt ?? Infinity);
    expect(restored?.sequence).toBe(first?.sequence);
  } finally {
    vi.useRealTimers();
  }
});
test("canonical reorder moves across hidden siblings, rejects stale approval and reports real boundary", async () => {
  const f = await fixture();
  const a = await f.owner.mutation(api.favorites.index.create, {
    workspaceId: f.workspaceId,
    target: { type: "folder" },
    name: "A",
    parentId: null,
  });
  await f.owner.mutation(api.favorites.index.create, {
    workspaceId: f.workspaceId,
    target: { type: "project", id: f.projectId },
    name: "Hidden",
    parentId: null,
  });
  const b = await f.owner.mutation(api.favorites.index.create, {
    workspaceId: f.workspaceId,
    target: { type: "folder" },
    name: "B",
    parentId: null,
  });
  await f.t.run((ctx) => ctx.db.patch(f.projectId, { archived: true }));
  const row = await f.t.run((ctx) => ctx.db.get(a));
  if (!row) throw new Error("Favorite missing");
  expect(
    await f.owner.mutation(api.favorites.reorder.move, {
      favoriteId: a,
      expectedUpdatedAt: row.updatedAt,
      direction: "up",
    })
  ).toEqual({ moved: true });
  const list = await f.owner.query(api.favorites.index.list, {
    workspaceId: f.workspaceId,
    parentId: null,
    deleted: false,
    paginationOpts: { cursor: null, numItems: 20 },
  });
  expect(list.page.map((item) => item._id)).toEqual([a, b]);
  await expect(
    f.owner.mutation(api.favorites.reorder.move, { favoriteId: a, expectedUpdatedAt: row.updatedAt, direction: "down" })
  ).rejects.toThrow("changed");
  expect(
    await f.owner.mutation(api.favorites.reorder.move, {
      favoriteId: a,
      expectedUpdatedAt: list.page[0].updatedAt,
      direction: "up",
    })
  ).toEqual({ moved: false });
});
