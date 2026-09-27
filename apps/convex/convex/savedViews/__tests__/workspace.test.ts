import { expect, test, vi } from "vitest";
import type { FunctionArgs } from "convex/server";
import { api, internal } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
const paginationOpts = { cursor: null, numItems: 100 };
const filters: FunctionArgs<typeof api.savedViews.workspace.create>["filters"] = {
  match: "all",
  statuses: [],
  stateIds: [],
  priorities: [],
  assigneeIds: [],
  labelIds: [],
  creatorIds: [],
  startDate: null,
  targetDate: null,
};
async function fixture() {
  const f = await workspaceJourney();
  const viewId = await f.owner.mutation(api.savedViews.workspace.create, {
    workspaceId: f.workspaceId,
    name: "Workspace view",
    description: "",
    filters,
  });
  return { ...f, viewId };
}
async function person(f: Awaited<ReturnType<typeof fixture>>, role: "admin" | "member" | "guest") {
  const userId = await f.t.run((ctx) => ctx.db.insert("users", { name: role }));
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role });
  return { userId, user: f.t.withIdentity({ subject: userId }) };
}
test("workspace admin has no implicit project visibility; sparse pages preserve cursor and authorized project identity", async () => {
  const f = await fixture();
  const admin = await person(f, "admin");
  await f.owner.mutation(api.projects.index.grantMember, {
    projectId: f.projectId,
    userId: admin.userId,
    role: "member",
  });
  const visible = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Visible" });
  const other = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Secret project",
    identifier: "SEC",
  });
  await f.owner.mutation(api.tasks.index.create, { projectId: other, title: "Secret task" });
  const first = await admin.user.query(api.savedViews.workspace.results, {
    viewId: f.viewId,
    paginationOpts: { cursor: null, numItems: 1 },
  });
  expect(first.page).toEqual([]);
  expect(first.isDone).toBe(false);
  const next = await admin.user.query(api.savedViews.workspace.results, {
    viewId: f.viewId,
    paginationOpts: { cursor: first.continueCursor, numItems: 1 },
  });
  expect(next.page.map((row) => row.task._id)).toEqual([visible]);
  expect(next.page[0].project.id).toBe(f.projectId);
  await f.owner.mutation(api.projects.index.revokeMember, { projectId: f.projectId, userId: admin.userId });
  expect((await admin.user.query(api.savedViews.workspace.results, { viewId: f.viewId, paginationOpts })).page).toEqual(
    []
  );
});
test("workspace guest owns its views, cannot favorite, and each project's guest policy controls task results", async () => {
  const f = await fixture();
  const guest = await person(f, "guest");
  await f.owner.mutation(api.projects.index.grantMember, {
    projectId: f.projectId,
    userId: guest.userId,
    role: "guest",
  });
  const own = await guest.user.mutation(api.savedViews.workspace.create, {
    workspaceId: f.workspaceId,
    name: "Own",
    description: "",
    filters,
  });
  await expect(guest.user.query(api.savedViews.workspace.get, { viewId: f.viewId })).rejects.toThrow("not found");
  await expect(guest.user.mutation(api.savedViews.workspace.favorite, { viewId: own, favorite: true })).rejects.toThrow(
    "Guests"
  );
  await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Other's task" });
  expect((await guest.user.query(api.savedViews.workspace.results, { viewId: own, paginationOpts })).page).toEqual([]);
  await f.owner.mutation(api.intakes.index.configure, {
    projectId: f.projectId,
    expectedRevision: 0,
    enabled: true,
    guestViewAllFeatures: true,
  });
  expect((await guest.user.query(api.savedViews.workspace.results, { viewId: own, paginationOpts })).page).toHaveLength(
    1
  );
  await f.owner.mutation(api.workspaces.index.revokeMember, { workspaceId: f.workspaceId, userId: guest.userId });
  await expect(guest.user.query(api.savedViews.workspace.results, { viewId: own, paginationOpts })).rejects.toThrow(
    "access"
  );
});
test("selected taxonomy metadata and directories redact revoked projects without dropping saved IDs", async () => {
  const f = await fixture();
  const member = await person(f, "member");
  await f.owner.mutation(api.projects.index.grantMember, {
    projectId: f.projectId,
    userId: member.userId,
    role: "member",
  });
  const stateId = await f.owner.mutation(api.tasks.states.save, {
    projectId: f.projectId,
    data: { name: "Secret state", description: "", color: "", status: "todo", sortOrder: 0, isDefault: true },
  });
  const labelId = await f.owner.mutation(api.tasks.labels.save, {
    projectId: f.projectId,
    data: { name: "Secret label", description: "", color: "", sortOrder: 0 },
  });
  const own = await member.user.mutation(api.savedViews.workspace.create, {
    workspaceId: f.workspaceId,
    name: "Selected",
    description: "",
    filters: { ...filters, stateIds: [stateId], labelIds: [labelId] },
  });
  expect((await member.user.query(api.savedViews.workspace.get, { viewId: own })).selections.states[0].name).toBe(
    "Secret state"
  );
  await f.owner.mutation(api.projects.index.revokeMember, { projectId: f.projectId, userId: member.userId });
  const detail = await member.user.query(api.savedViews.workspace.get, { viewId: own });
  expect(detail.selections.states).toEqual([{ id: stateId, name: null }]);
  expect(detail.selections.labels).toEqual([{ id: labelId, name: null }]);
  expect(
    (await member.user.query(api.savedViews.workspaceChoices.states, { workspaceId: f.workspaceId, paginationOpts }))
      .page
  ).toEqual([]);
  await expect(
    member.user.mutation(api.savedViews.workspace.update, {
      viewId: own,
      expectedUpdatedAt: detail.view.updatedAt,
      name: "Still selected",
      description: "",
      filters: detail.view.filters,
    })
  ).rejects.toThrow("accessible project");
  await member.user.mutation(api.savedViews.workspace.update, {
    viewId: own,
    expectedUpdatedAt: detail.view.updatedAt,
    name: "Removed inaccessible clauses",
    description: "",
    filters,
  });
});
test("workspace owner edit and admin recovery preserve personal favorites with monotonic CAS", async () => {
  vi.useFakeTimers();
  try {
    const f = await fixture();
    const admin = await person(f, "admin");
    let detail = await f.owner.query(api.savedViews.workspace.get, { viewId: f.viewId });
    await expect(
      admin.user.mutation(api.savedViews.workspace.update, {
        viewId: f.viewId,
        expectedUpdatedAt: detail.view.updatedAt,
        name: "Hijack",
        description: "",
        filters,
      })
    ).rejects.toThrow("owner");
    await f.owner.mutation(api.savedViews.workspace.favorite, { viewId: f.viewId, favorite: true });
    await f.owner.mutation(api.savedViews.workspace.favorite, { viewId: f.viewId, favorite: true });
    expect(
      (await f.owner.query(api.savedViews.workspace.favorites, { workspaceId: f.workspaceId, paginationOpts })).page
    ).toHaveLength(1);
    await admin.user.mutation(api.savedViews.workspace.lifecycle, {
      viewId: f.viewId,
      expectedUpdatedAt: detail.view.updatedAt,
      deleted: true,
    });
    expect(
      (await f.owner.query(api.savedViews.workspace.favorites, { workspaceId: f.workspaceId, paginationOpts })).page
    ).toEqual([]);
    await expect(
      admin.user.mutation(api.savedViews.workspace.lifecycle, {
        viewId: f.viewId,
        expectedUpdatedAt: detail.view.updatedAt,
        deleted: false,
      })
    ).rejects.toThrow("changed");
    detail = await admin.user.query(api.savedViews.workspace.get, { viewId: f.viewId });
    await admin.user.mutation(api.savedViews.workspace.lifecycle, {
      viewId: f.viewId,
      expectedUpdatedAt: detail.view.updatedAt,
      deleted: false,
    });
    expect(
      (await f.owner.query(api.savedViews.workspace.favorites, { workspaceId: f.workspaceId, paginationOpts })).page
    ).toHaveLength(1);
  } finally {
    vi.useRealTimers();
  }
});
test("old project rows remain readable before bounded backfill; IDs, revisions and favorites remain unchanged", async () => {
  const f = await fixture();
  const projectView = await f.owner.mutation(api.savedViews.index.create, {
    projectId: f.projectId,
    name: "Legacy",
    description: "",
    filters,
  });
  await f.owner.mutation(api.savedViews.favorites.set, { viewId: projectView, favorite: true });
  await f.t.run(async (ctx) => {
    await ctx.db.patch(projectView, { workspaceId: undefined });
    const favorite = await ctx.db
      .query("savedViewFavorites")
      .withIndex("by_view_user", (q) => q.eq("viewId", projectView).eq("userId", f.userId))
      .unique();
    if (favorite) await ctx.db.patch(favorite._id, { workspaceId: undefined });
  });
  const before = await f.owner.query(api.savedViews.index.get, { viewId: projectView });
  expect(before.isFavorite).toBe(true);
  await expect(f.owner.query(api.savedViews.workspace.get, { viewId: projectView })).rejects.toThrow("not found");
  await expect(f.owner.query(api.savedViews.index.get, { viewId: f.viewId })).rejects.toThrow("not found");
  await Promise.all(
    (["views", "favorites"] as const).map(async (table) => {
      const first = await f.t.mutation(internal.savedViews.migrations.workspaceScopes, { table, cursor: null });
      expect(first.changed).toBe(1);
      expect(first.isDone).toBe(true);
      expect(
        (await f.t.mutation(internal.savedViews.migrations.workspaceScopes, { table, cursor: null })).changed
      ).toBe(0);
    })
  );
  const after = await f.owner.query(api.savedViews.index.get, { viewId: projectView });
  expect(after.view._id).toBe(before.view._id);
  expect(after.view.updatedAt).toBe(before.view.updatedAt);
  expect(after.isFavorite).toBe(true);
  expect(after.view.workspaceId).toBe(f.workspaceId);
});
test("workspace definitions reject cross-workspace taxonomy and reuse canonical date/filter validation", async () => {
  const f = await fixture();
  const otherWorkspace = await f.owner.mutation(api.workspaces.index.create, {
    name: "Other workspace",
    slug: "other-view-workspace",
  });
  const projectId = await f.owner.mutation(api.projects.index.create, {
    workspaceId: otherWorkspace,
    name: "Other",
    identifier: "OTH",
  });
  const labelId = await f.owner.mutation(api.tasks.labels.save, {
    projectId,
    data: { name: "Foreign", description: "", color: "", sortOrder: 0 },
  });
  const base = { workspaceId: f.workspaceId, name: "Rejected", description: "" };
  await expect(
    f.owner.mutation(api.savedViews.workspace.create, { ...base, filters: { ...filters, labelIds: [labelId] } })
  ).rejects.toThrow("accessible project");
  await expect(
    f.owner.mutation(api.savedViews.workspace.create, {
      ...base,
      filters: { ...filters, startDate: { from: "2026-02-30", to: null } },
    })
  ).rejects.toThrow("valid ISO");
  await expect(
    f.owner.mutation(api.savedViews.workspace.create, { ...base, filters: { ...filters, statuses: ["todo", "todo"] } })
  ).rejects.toThrow("distinct");
});
