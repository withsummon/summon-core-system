// Sequential visits establish the retention and ordering scenario.
/* oxlint-disable no-await-in-loop */
import type { Id } from "../../_generated/dataModel";
import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
test("recent items retain latest twenty creations; repeat visit updates timestamp without duplicate or ordering change", async () => {
  const f = await workspaceJourney();
  const projects: Id<"projects">[] = [];
  for (let i = 0; i < 21; i++) {
    const id = await f.owner.mutation(api.projects.index.create, {
      workspaceId: f.workspaceId,
      name: `Project ${i}`,
      identifier: `P${i}`,
    });
    projects.push(id);
    await f.owner.mutation(api.navigation.recent.record, {
      workspaceId: f.workspaceId,
      target: { type: "project", id },
    });
  }
  const before = await f.owner.query(api.navigation.recent.list, { workspaceId: f.workspaceId });
  expect(before).toHaveLength(20);
  expect(before.some((row) => row.target.id === projects[0])).toBe(false);
  const oldest = before[19];
  await f.owner.mutation(api.navigation.recent.record, { workspaceId: f.workspaceId, target: oldest.target });
  const after = await f.owner.query(api.navigation.recent.list, { workspaceId: f.workspaceId, type: "project" });
  expect(after.map((row) => row.id)).toEqual(before.map((row) => row.id));
  expect(after[19].visitedAt).toBeGreaterThan(oldest.visitedAt);
  expect(await f.owner.query(api.navigation.recent.list, { workspaceId: f.workspaceId, type: "page" })).toEqual([]);
});
test("guest navigation is personal and rechecks membership, archived projects, and revoked access", async () => {
  const f = await workspaceJourney();
  const guestId = await f.t.run(async (ctx) => {
    const id = await ctx.db.insert("users", { name: "Guest" });
    await ctx.db.insert("workspaceMembers", { workspaceId: f.workspaceId, userId: id, role: "guest", active: true });
    await ctx.db.insert("projectMembers", {
      workspaceId: f.workspaceId,
      projectId: f.projectId,
      userId: id,
      role: "guest",
      active: true,
    });
    return id;
  });
  const guest = f.t.withIdentity({ subject: guestId });
  const args = { workspaceId: f.workspaceId, target: { type: "project" as const, id: f.projectId } };
  await guest.mutation(api.navigation.recent.record, args);
  expect(await guest.query(api.navigation.recent.list, { workspaceId: f.workspaceId })).toHaveLength(1);
  expect(await f.owner.query(api.navigation.recent.list, { workspaceId: f.workspaceId })).toHaveLength(0);
  await f.t.run((ctx) => ctx.db.patch(f.projectId, { archived: true }));
  expect(await guest.query(api.navigation.recent.list, { workspaceId: f.workspaceId })).toEqual([]);
  await expect(guest.mutation(api.navigation.recent.record, args)).rejects.toThrow("unavailable");
  await f.t.run(async (ctx) => {
    const member = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", f.workspaceId).eq("userId", guestId))
      .unique();
    if (member) await ctx.db.patch(member._id, { active: false });
  });
  await expect(guest.query(api.navigation.recent.list, { workspaceId: f.workspaceId })).rejects.toThrow("access");
});
test("preference initialization is idempotent, guest-accessible and preserves all seven keys and pinned defaults", async () => {
  const f = await workspaceJourney();
  await f.t.run(async (ctx) => {
    const member = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", f.workspaceId).eq("userId", f.userId))
      .unique();
    if (member) await ctx.db.patch(member._id, { role: "guest" });
  });
  expect((await f.owner.query(api.navigation.preferences.list, { workspaceId: f.workspaceId })).initialized).toBe(
    false
  );
  await f.owner.mutation(api.navigation.preferences.ensure, { workspaceId: f.workspaceId });
  await f.owner.mutation(api.navigation.preferences.ensure, { workspaceId: f.workspaceId });
  const result = await f.owner.query(api.navigation.preferences.list, { workspaceId: f.workspaceId });
  expect(result.initialized).toBe(true);
  expect(result.preferences.map((row) => row.key)).toEqual([
    "views",
    "active_cycles",
    "analytics",
    "drafts",
    "your_work",
    "archives",
    "stickies",
  ]);
  expect(result.preferences.filter((row) => row.isPinned).map((row) => row.key)).toEqual([
    "drafts",
    "your_work",
    "stickies",
  ]);
  expect(result.preferences.map((row) => row.sortOrder)).toEqual([65535, 75535, 85535, 95535, 105535, 115535, 125535]);
});
test("preference batch conflict rolls back preceding changes and repeat seeding never overwrites personal order", async () => {
  const f = await workspaceJourney();
  const scope = { workspaceId: f.workspaceId };
  await f.owner.mutation(api.navigation.preferences.ensure, scope);
  await f.owner.mutation(api.navigation.preferences.update, {
    ...scope,
    changes: [{ key: "views", expectedRevision: 0, isPinned: true, sortOrder: -10 }],
  });
  await expect(
    f.owner.mutation(api.navigation.preferences.update, {
      ...scope,
      changes: [
        { key: "analytics", expectedRevision: 0, isPinned: true },
        { key: "views", expectedRevision: 0, isPinned: false },
      ],
    })
  ).rejects.toThrow("changed");
  await f.owner.mutation(api.navigation.preferences.ensure, scope);
  const rows = (await f.owner.query(api.navigation.preferences.list, scope)).preferences;
  expect(rows[0]).toMatchObject({ key: "views", isPinned: true, sortOrder: -10, revision: 1 });
  expect(rows.find((row) => row.key === "analytics")?.isPinned).toBe(false);
  await expect(
    f.owner.mutation(api.navigation.preferences.update, {
      ...scope,
      changes: [
        { key: "views", expectedRevision: 1 },
        { key: "views", expectedRevision: 1 },
      ],
    })
  ).rejects.toThrow("distinct");
});
test("recent task and document metadata disappear after canonical visibility changes", async () => {
  const f = await workspaceJourney();
  const taskId = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Restricted task" });
  const documentId = await f.owner.mutation(api.documents.index.create, {
    workspaceId: f.workspaceId,
    name: "Shared document",
    access: "public",
    isGlobal: true,
    projectIds: [],
    color: "",
    viewProps: {},
    logoProps: {},
    sortOrder: 0,
    category: "",
    tags: [],
    clientId: null,
    opportunityId: null,
    externalId: null,
    externalSource: null,
  });
  const guestId = await f.t.run(async (ctx) => {
    const id = await ctx.db.insert("users", { name: "Reader" });
    await ctx.db.insert("workspaceMembers", { workspaceId: f.workspaceId, userId: id, role: "guest", active: true });
    await ctx.db.insert("projectMembers", {
      workspaceId: f.workspaceId,
      projectId: f.projectId,
      userId: id,
      role: "guest",
      active: true,
    });
    await ctx.db.patch(f.projectId, { guestViewAllFeatures: true });
    return id;
  });
  const guest = f.t.withIdentity({ subject: guestId });
  const scope = { workspaceId: f.workspaceId };
  await guest.mutation(api.navigation.recent.record, { ...scope, target: { type: "issue", id: taskId } });
  await guest.mutation(api.navigation.recent.record, { ...scope, target: { type: "page", id: documentId } });
  expect(await guest.query(api.navigation.recent.list, scope)).toHaveLength(2);
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.projectId, { guestViewAllFeatures: false });
    await ctx.db.patch(documentId, { access: "private" });
  });
  expect(await guest.query(api.navigation.recent.list, scope)).toEqual([]);
  await expect(
    guest.mutation(api.navigation.recent.record, { ...scope, target: { type: "issue", id: taskId } })
  ).rejects.toThrow("unavailable");
  await expect(
    guest.mutation(api.navigation.recent.record, { ...scope, target: { type: "page", id: documentId } })
  ).rejects.toThrow("unavailable");
});
