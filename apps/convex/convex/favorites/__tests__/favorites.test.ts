import { signedIn } from "../../../test-support/session";
import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import type { Id } from "../../_generated/dataModel";
async function fixture() {
  const f = await workspaceJourney();
  const folder = (name: string, parentId: Id<"favorites"> | null = null) =>
    f.owner.mutation(api.favorites.index.create, {
      workspaceId: f.workspaceId,
      target: { type: "folder" },
      name,
      parentId,
    });
  const rows = (parentId: Id<"favorites"> | null = null, deleted = false) =>
    f.owner.query(api.favorites.index.list, {
      workspaceId: f.workspaceId,
      parentId,
      deleted,
      paginationOpts: { cursor: null, numItems: 100 },
    });
  const get = (id: Id<"favorites">) =>
    f.t.run(async (ctx) => {
      const row = await ctx.db.get(id);
      if (!row) throw new Error("Fixture missing");
      return row;
    });
  return { ...f, folder, rows, get };
}
test("favorites are private, guests denied, idempotent target additions preserve ordered placement", async () => {
  const f = await fixture();
  const args = {
    workspaceId: f.workspaceId,
    target: { type: "project" as const, id: f.projectId },
    name: null,
    parentId: null,
  };
  const id = await f.owner.mutation(api.favorites.index.create, args);
  expect(await f.owner.mutation(api.favorites.index.create, args)).toBe(id);
  const otherId = await f.t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {});
    await ctx.db.insert("workspaceMembers", { workspaceId: f.workspaceId, userId, role: "admin", active: true });
    return userId;
  });
  const other = await signedIn(f.t, otherId);
  expect(
    (
      await other.query(api.favorites.index.list, {
        workspaceId: f.workspaceId,
        parentId: null,
        deleted: false,
        paginationOpts: { cursor: null, numItems: 20 },
      })
    ).page
  ).toHaveLength(0);
  await expect(
    other.mutation(api.favorites.index.lifecycle, {
      favoriteId: id,
      expectedUpdatedAt: (await f.get(id)).updatedAt,
      deleted: true,
    })
  ).rejects.toThrow("not found");
  await f.t.run(async (ctx) => {
    const m = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", f.workspaceId).eq("userId", otherId))
      .unique();
    if (m) await ctx.db.patch(m._id, { role: "guest" });
  });
  await expect(
    other.query(api.favorites.index.list, {
      workspaceId: f.workspaceId,
      parentId: null,
      deleted: false,
      paginationOpts: { cursor: null, numItems: 20 },
    })
  ).rejects.toThrow("workspace");
});
test("folder removal hides retained descendants and restore preserves order and independent child deletion", async () => {
  const f = await fixture();
  const root = await f.folder("Root"),
    child = await f.folder("Child", root),
    leaf = await f.folder("Leaf", child);
  const before = await f.get(leaf);
  await f.owner.mutation(api.favorites.index.lifecycle, {
    favoriteId: root,
    expectedUpdatedAt: (await f.get(root)).updatedAt,
    deleted: true,
  });
  expect((await f.rows()).page).toHaveLength(0);
  await expect(f.rows(child)).rejects.toThrow("Restore");
  expect((await f.rows(null, true)).page[0]._id).toBe(root);
  await f.owner.mutation(api.favorites.index.lifecycle, {
    favoriteId: root,
    expectedUpdatedAt: (await f.get(root)).updatedAt,
    deleted: false,
  });
  expect((await f.rows(child)).page[0].sequence).toBe(before.sequence);
  expect((await f.rows(child)).page[0]._id).toBe(leaf);
});
test("moves reject cycles and subtree depth overflow, CAS rejects stale updates", async () => {
  const f = await fixture();
  const root = await f.folder("Root"),
    child = await f.folder("Child", root);
  const row = await f.get(root);
  await expect(
    f.owner.mutation(api.favorites.index.update, {
      favoriteId: root,
      expectedUpdatedAt: row.updatedAt,
      name: row.name,
      parentId: child,
      sequence: row.sequence,
    })
  ).rejects.toThrow("cycle");
  await f.owner.mutation(api.favorites.index.update, {
    favoriteId: root,
    expectedUpdatedAt: row.updatedAt,
    name: "Renamed",
    parentId: null,
    sequence: 1,
  });
  await expect(
    f.owner.mutation(api.favorites.index.update, {
      favoriteId: root,
      expectedUpdatedAt: row.updatedAt,
      name: "Stale",
      parentId: null,
      sequence: 2,
    })
  ).rejects.toThrow("changed");
  let parent = await f.folder("Depth 1");
  for (let i = 2; i <= 20; i++) {
    // Each new folder needs the preceding parent ID.
    // eslint-disable-next-line no-await-in-loop
    parent = await f.folder(`Depth ${i}`, parent);
  }
  await expect(f.folder("Too deep", parent)).rejects.toThrow("20-level");
  const current = await f.get(root);
  await expect(
    f.owner.mutation(api.favorites.index.update, {
      favoriteId: root,
      expectedUpdatedAt: current.updatedAt,
      name: current.name,
      parentId: parent,
      sequence: 3,
    })
  ).rejects.toThrow("20 levels");
});
test("current target visibility removes revoked project titles without breaking sparse pagination", async () => {
  const f = await fixture();
  await f.folder("Visible");
  await f.owner.mutation(api.favorites.index.create, {
    workspaceId: f.workspaceId,
    target: { type: "project", id: f.projectId },
    name: "Sensitive override",
    parentId: null,
  });
  await f.t.run((ctx) => ctx.db.patch(f.projectId, { archived: true }));
  const page = await f.owner.query(api.favorites.index.list, {
    workspaceId: f.workspaceId,
    parentId: null,
    deleted: false,
    paginationOpts: { cursor: null, numItems: 1 },
  });
  expect(page.page).toHaveLength(0);
  expect(page.isDone).toBe(false);
  const next = await f.owner.query(api.favorites.index.list, {
    workspaceId: f.workspaceId,
    parentId: null,
    deleted: false,
    paginationOpts: { cursor: page.continueCursor, numItems: 1 },
  });
  expect(next.page[0].name).toBe("Visible");
});

test("moving a subtree updates height and a trashed ancestor does not silently swallow re-add", async () => {
  const f = await fixture();
  const a = await f.folder("A"),
    b = await f.folder("B", a),
    c = await f.folder("C", b);
  const row = await f.get(b);
  await f.owner.mutation(api.favorites.index.update, {
    favoriteId: b,
    expectedUpdatedAt: row.updatedAt,
    name: row.name,
    parentId: null,
    sequence: 10,
  });
  expect((await f.get(a)).height).toBe(1);
  expect((await f.get(b)).height).toBe(2);
  const moved = await f.get(b);
  await f.owner.mutation(api.favorites.index.update, {
    favoriteId: b,
    expectedUpdatedAt: moved.updatedAt,
    name: moved.name,
    parentId: a,
    sequence: 10,
  });
  expect((await f.get(a)).height).toBe(3);
  const target = { type: "project" as const, id: f.projectId };
  await f.owner.mutation(api.favorites.index.create, { workspaceId: f.workspaceId, target, name: null, parentId: c });
  await f.owner.mutation(api.favorites.index.lifecycle, {
    favoriteId: a,
    expectedUpdatedAt: (await f.get(a)).updatedAt,
    deleted: true,
  });
  await expect(
    f.owner.mutation(api.favorites.index.create, { workspaceId: f.workspaceId, target, name: null, parentId: null })
  ).rejects.toThrow("parent folder");
});
