import { signedIn } from "../../../test-support/session";
import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";

test("archive retains identity, children, administrator and identifier reservation; restore reopens same task", async () => {
  const f = await workspaceJourney();
  const taskId = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Retained work" });
  const before = await f.owner.query(api.projects.settings.get, { projectId: f.projectId });
  await f.owner.mutation(api.projects.settings.setArchived, {
    projectId: f.projectId,
    archived: true,
    expectedRevision: before.revision,
  });
  expect(await f.owner.query(api.projects.index.list, { workspaceId: f.workspaceId })).toHaveLength(0);
  await expect(f.owner.query(api.tasks.index.get, { taskId })).rejects.toThrow("Project not found");
  await expect(
    f.owner.mutation(api.projects.index.create, {
      workspaceId: f.workspaceId,
      name: "Duplicate",
      identifier: before.identifier,
    })
  ).rejects.toThrow("already taken");
  const archived = await f.owner.query(api.projects.settings.archived, {
    workspaceId: f.workspaceId,
    paginationOpts: { cursor: null, numItems: 20 },
  });
  expect(archived.page[0]).toMatchObject({ _id: f.projectId, canRestore: true });
  await f.owner.mutation(api.projects.settings.setArchived, {
    projectId: f.projectId,
    archived: false,
    expectedRevision: archived.page[0].revision,
  });
  expect((await f.owner.query(api.tasks.index.get, { taskId }))._id).toBe(taskId);
  await expect(
    f.owner.mutation(api.projects.index.revokeMember, { projectId: f.projectId, userId: f.userId })
  ).rejects.toThrow("another project administrator");
});

test("metadata drafts and lifecycle transitions share a revision, immutable identifier and timezone stay unchanged", async () => {
  const f = await workspaceJourney();
  const before = await f.owner.query(api.projects.settings.get, { projectId: f.projectId });
  const draft = {
    projectId: f.projectId,
    expectedRevision: before.revision,
    name: "Renamed",
    description: "Plain project scope",
  };
  await f.owner.mutation(api.projects.settings.save, draft);
  await expect(f.owner.mutation(api.projects.settings.save, { ...draft, name: "Stale" })).rejects.toThrow("changed");
  await expect(
    f.owner.mutation(api.projects.settings.setArchived, {
      projectId: f.projectId,
      expectedRevision: before.revision,
      archived: true,
    })
  ).rejects.toThrow("changed");
  expect(await f.owner.query(api.projects.settings.get, { projectId: f.projectId })).toMatchObject({
    name: "Renamed",
    description: draft.description,
    identifier: before.identifier,
    revision: before.revision + 1,
  });
});

test("ordinary project member cannot manage lifecycle and revoked administrator cannot recover", async () => {
  const f = await workspaceJourney();
  const userId = await f.t.run(async (ctx) => {
    const id = await ctx.db.insert("users", { name: "Member" });
    await ctx.db.insert("workspaceMembers", { workspaceId: f.workspaceId, userId: id, role: "member", active: true });
    await ctx.db.insert("projectMembers", {
      workspaceId: f.workspaceId,
      projectId: f.projectId,
      userId: id,
      role: "member",
      active: true,
    });
    return id;
  });
  const member = await signedIn(f.t, userId);
  const before = await f.owner.query(api.projects.settings.get, { projectId: f.projectId });
  expect((await member.query(api.projects.settings.get, { projectId: f.projectId })).canManage).toBe(false);
  await expect(
    member.mutation(api.projects.settings.setArchived, {
      projectId: f.projectId,
      archived: true,
      expectedRevision: before.revision,
    })
  ).rejects.toThrow("administrators");
  await f.owner.mutation(api.projects.settings.setArchived, {
    projectId: f.projectId,
    archived: true,
    expectedRevision: before.revision,
  });
  const page = await member.query(api.projects.settings.archived, {
    workspaceId: f.workspaceId,
    paginationOpts: { cursor: null, numItems: 20 },
  });
  expect(page.page[0].canRestore).toBe(false);
  await expect(
    member.mutation(api.projects.settings.setArchived, {
      projectId: f.projectId,
      archived: false,
      expectedRevision: page.page[0].revision,
    })
  ).rejects.toThrow("administrators");
  await f.t.run(async (ctx) => {
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", f.projectId).eq("userId", f.userId))
      .unique();
    if (!membership) throw new Error("Fixture missing");
    await ctx.db.patch(membership._id, { active: false });
  });
  await expect(
    f.owner.mutation(api.projects.settings.setArchived, {
      projectId: f.projectId,
      archived: false,
      expectedRevision: page.page[0].revision,
    })
  ).rejects.toThrow("access");
});

test("archived list preserves cursor past active candidates and workspace guest cannot recover even with stale project admin role", async () => {
  const f = await workspaceJourney();
  const second = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Recovery",
    identifier: "REC",
  });
  await f.owner.mutation(api.projects.settings.setArchived, { projectId: second, archived: true, expectedRevision: 0 });
  const first = await f.owner.query(api.projects.settings.archived, {
    workspaceId: f.workspaceId,
    paginationOpts: { cursor: null, numItems: 1 },
  });
  expect(first.page).toEqual([]);
  expect(first.isDone).toBe(false);
  const next = await f.owner.query(api.projects.settings.archived, {
    workspaceId: f.workspaceId,
    paginationOpts: { cursor: first.continueCursor, numItems: 1 },
  });
  expect(next.page[0]._id).toBe(second);
  await f.t.run(async (ctx) => {
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", f.workspaceId).eq("userId", f.userId))
      .unique();
    if (!membership) throw new Error("Fixture missing");
    await ctx.db.patch(membership._id, { role: "guest" });
  });
  const guestList = await f.owner.query(api.projects.settings.archived, {
    workspaceId: f.workspaceId,
    paginationOpts: { cursor: null, numItems: 20 },
  });
  expect(guestList.page[0].canRestore).toBe(false);
  await expect(
    f.owner.mutation(api.projects.settings.setArchived, { projectId: second, archived: false, expectedRevision: 1 })
  ).rejects.toThrow("access");
});

for (const restriction of ["revoke", "guest"] as const) {
  test(`archived project's final administrator survives workspace ${restriction}; retained second admin can restore`, async () => {
    const f = await workspaceJourney();
    const managerId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Workspace administrator" }));
    await f.owner.mutation(api.workspaces.index.grantMember, {
      workspaceId: f.workspaceId,
      userId: managerId,
      role: "admin",
    });
    const manager = await signedIn(f.t, managerId);
    await f.owner.mutation(api.projects.settings.setArchived, {
      projectId: f.projectId,
      archived: true,
      expectedRevision: 0,
    });
    const restrict = () =>
      restriction === "revoke"
        ? manager.mutation(api.workspaces.index.revokeMember, { workspaceId: f.workspaceId, userId: f.userId })
        : manager.mutation(api.workspaces.index.grantMember, {
            workspaceId: f.workspaceId,
            userId: f.userId,
            role: "guest",
          });
    await expect(restrict()).rejects.toThrow("another project administrator");
    await f.owner.mutation(api.projects.settings.setArchived, {
      projectId: f.projectId,
      archived: false,
      expectedRevision: 1,
    });
    await f.owner.mutation(api.projects.index.grantMember, {
      projectId: f.projectId,
      userId: managerId,
      role: "admin",
    });
    await f.owner.mutation(api.projects.settings.setArchived, {
      projectId: f.projectId,
      archived: true,
      expectedRevision: 2,
    });
    await restrict();
    await manager.mutation(api.projects.settings.setArchived, {
      projectId: f.projectId,
      archived: false,
      expectedRevision: 3,
    });
    expect((await manager.query(api.projects.settings.get, { projectId: f.projectId })).canManage).toBe(true);
  });
}

test("archived list rejects invalid pagination budgets rather than silently changing them", async () => {
  const f = await workspaceJourney();
  await Promise.all(
    [0, -1, 51, 1.5, Number.NaN].map((numItems) =>
      expect(
        f.owner.query(api.projects.settings.archived, {
          workspaceId: f.workspaceId,
          paginationOpts: { cursor: null, numItems },
        })
      ).rejects.toThrow("Page size")
    )
  );
});
