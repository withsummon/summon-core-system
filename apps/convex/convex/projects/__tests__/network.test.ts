import { expect, test } from "vitest";
import { api, internal } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
const paginationOpts = { cursor: null, numItems: 20 };
async function member(role: "admin" | "member" | "guest" = "member") {
  const f = await workspaceJourney();
  const userId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Reader" }));
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role });
  return { ...f, userId, actor: await signedIn(f.t, userId) };
}
test("public discovery requires workspace membership; task access needs a real explicit join", async () => {
  const f = await member();
  const taskId = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Members only" });
  const rows = await f.actor.query(api.projects.network.list, { workspaceId: f.workspaceId, paginationOpts });
  expect(rows.page).toHaveLength(1);
  expect(rows.page[0]).toMatchObject({ network: 2, joined: false, canJoin: true });
  await expect(f.actor.query(api.tasks.index.get, { taskId })).rejects.toThrow("access to this project");
  await f.actor.mutation(api.projects.network.join, { projectId: f.projectId, expectedRevision: 0 });
  expect((await f.actor.query(api.tasks.index.get, { taskId })).title).toBe("Members only");
  const membership = await f.t.run((ctx) =>
    ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", f.projectId).eq("userId", f.userId))
      .unique()
  );
  expect(membership).toMatchObject({ active: true, role: "member" });
  const outsideId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Outside" }));
  const outside = await signedIn(f.t, outsideId);
  await expect(outside.query(api.projects.network.get, { projectId: f.projectId })).rejects.toThrow("workspace");
});
test("private discovery and join are admin-only for nonmembers; network never implies admin content access", async () => {
  const f = await member();
  await f.owner.mutation(api.projects.network.save, { projectId: f.projectId, network: 0, expectedRevision: 0 });
  expect((await f.actor.query(api.projects.network.list, { workspaceId: f.workspaceId, paginationOpts })).page).toEqual(
    []
  );
  await expect(
    f.actor.mutation(api.projects.network.join, { projectId: f.projectId, expectedRevision: 1 })
  ).rejects.toThrow("cannot join");
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: f.userId,
    role: "admin",
  });
  expect((await f.actor.query(api.projects.network.get, { projectId: f.projectId })).canJoin).toBe(true);
  await expect(f.actor.query(api.projects.settings.get, { projectId: f.projectId })).rejects.toThrow(
    "access to this project"
  );
  await f.actor.mutation(api.projects.network.join, { projectId: f.projectId, expectedRevision: 1 });
  expect((await f.actor.query(api.projects.settings.get, { projectId: f.projectId })).canManage).toBe(true);
});
test("guest discovery is membership-only and guest cannot self-join; rejoin preserves existing role", async () => {
  const f = await member("guest");
  expect((await f.actor.query(api.projects.network.list, { workspaceId: f.workspaceId, paginationOpts })).page).toEqual(
    []
  );
  await expect(
    f.actor.mutation(api.projects.network.join, { projectId: f.projectId, expectedRevision: 0 })
  ).rejects.toThrow("cannot join");
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId: f.userId, role: "guest" });
  expect((await f.actor.query(api.projects.network.get, { projectId: f.projectId })).joined).toBe(true);
  await f.actor.mutation(api.projects.index.leave, { projectId: f.projectId });
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: f.userId,
    role: "member",
  });
  await f.actor.mutation(api.projects.network.join, { projectId: f.projectId, expectedRevision: 0 });
  expect((await f.actor.query(api.projects.index.list, { workspaceId: f.workspaceId }))[0].membershipRole).toBe(
    "guest"
  );
});
test("fresh CAS and lifecycle/membership rechecks prevent stale join or unauthorized policy writes", async () => {
  const f = await member();
  await expect(
    f.actor.mutation(api.projects.network.save, { projectId: f.projectId, network: 0, expectedRevision: 0 })
  ).rejects.toThrow("administrators");
  await f.owner.mutation(api.projects.network.save, { projectId: f.projectId, network: 0, expectedRevision: 0 });
  await expect(
    f.owner.mutation(api.projects.network.save, { projectId: f.projectId, network: 2, expectedRevision: 0 })
  ).rejects.toThrow("changed");
  await f.owner.mutation(api.projects.network.save, { projectId: f.projectId, network: 2, expectedRevision: 1 });
  await expect(
    f.actor.mutation(api.projects.network.join, { projectId: f.projectId, expectedRevision: 0 })
  ).rejects.toThrow("changed");
  await f.owner.mutation(api.workspaces.index.revokeMember, { workspaceId: f.workspaceId, userId: f.userId });
  await expect(
    f.actor.mutation(api.projects.network.join, { projectId: f.projectId, expectedRevision: 2 })
  ).rejects.toThrow("workspace");
  await f.owner.mutation(api.projects.lifecycle.setDeleted, {
    projectId: f.projectId,
    deleted: true,
    expectedRevision: 2,
  });
  await expect(f.owner.query(api.projects.network.get, { projectId: f.projectId })).rejects.toThrow("not found");
});
test("backfill keeps prior native membership-only privacy and does not overwrite explicit public choice", async () => {
  const f = await workspaceJourney();
  await f.t.run((ctx) => ctx.db.patch(f.projectId, { network: undefined }));
  const second = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Public",
    identifier: "PUB",
  });
  expect(await f.t.mutation(internal.projects.network.backfill, { cursor: null })).toMatchObject({
    changed: 1,
    processed: 2,
    isDone: true,
  });
  expect((await f.t.mutation(internal.projects.network.backfill, { cursor: null })).changed).toBe(0);
  expect((await f.t.run((ctx) => ctx.db.get(f.projectId)))?.network).toBe(0);
  expect((await f.t.run((ctx) => ctx.db.get(second)))?.network).toBe(2);
});
test("discovery preserves sparse cursors and network changes retain existing members", async () => {
  const f = await member();
  await f.owner.mutation(api.projects.network.save, { projectId: f.projectId, network: 0, expectedRevision: 0 });
  const second = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Discoverable",
    identifier: "NEXT",
  });
  const first = await f.actor.query(api.projects.network.list, {
    workspaceId: f.workspaceId,
    paginationOpts: { numItems: 1, cursor: null },
  });
  expect(first.page).toEqual([]);
  expect(first.isDone).toBe(false);
  const next = await f.actor.query(api.projects.network.list, {
    workspaceId: f.workspaceId,
    paginationOpts: { numItems: 1, cursor: first.continueCursor },
  });
  expect(next.page.map((row) => row.projectId)).toEqual([second]);
  await f.actor.mutation(api.projects.network.join, { projectId: second, expectedRevision: 0 });
  await f.owner.mutation(api.projects.network.save, { projectId: second, network: 0, expectedRevision: 0 });
  expect((await f.actor.query(api.projects.network.get, { projectId: second })).joined).toBe(true);
  expect(
    (await f.actor.query(api.projects.index.list, { workspaceId: f.workspaceId })).map((row) => row._id)
  ).toContain(second);
});
test("bulk join validates all scopes and revisions before granting any membership", async () => {
  const f = await member();
  const second = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Second",
    identifier: "SECOND",
  });
  const foreignWorkspace = await f.actor.mutation(api.workspaces.index.create, { name: "Foreign", slug: "foreign" });
  const foreign = await f.actor.mutation(api.projects.index.create, {
    workspaceId: foreignWorkspace,
    name: "Foreign",
    identifier: "OTHER",
  });
  const targets = [
    { projectId: f.projectId, expectedRevision: 0 },
    { projectId: second, expectedRevision: 0 },
  ];
  await expect(
    f.actor.mutation(api.projects.network.joinMany, {
      workspaceId: f.workspaceId,
      projects: [targets[0], { projectId: foreign, expectedRevision: 0 }],
    })
  ).rejects.toThrow("selected workspace");
  await expect(
    f.actor.mutation(api.projects.network.joinMany, {
      workspaceId: f.workspaceId,
      projects: [targets[0], { ...targets[1], expectedRevision: 99 }],
    })
  ).rejects.toThrow("changed");
  expect(await f.actor.query(api.projects.index.list, { workspaceId: f.workspaceId })).toEqual([]);
  expect(
    await f.actor.mutation(api.projects.network.joinMany, { workspaceId: f.workspaceId, projects: targets })
  ).toEqual({ joinedProjectIds: [f.projectId, second] });
  const rows = (await f.actor.query(api.projects.network.list, { workspaceId: f.workspaceId, paginationOpts })).page;
  expect(rows.every((row) => row.memberRole === "member")).toBe(true);
  expect(new Set(rows.map((row) => row.personalOrder?.sortOrder)).size).toBe(2);
  await expect(
    f.actor.mutation(api.projects.network.joinMany, { workspaceId: f.workspaceId, projects: [targets[0], targets[0]] })
  ).rejects.toThrow("once");
  await expect(
    f.actor.mutation(api.projects.network.joinMany, {
      workspaceId: f.workspaceId,
      projects: Array.from({ length: 21 }, () => targets[0]),
    })
  ).rejects.toThrow("20");
});
test("directory metadata uses the same canonical detail projection without manufacturing member roles", async () => {
  const f = await member();
  const detail = await f.actor.query(api.projects.network.get, { projectId: f.projectId });
  const row = (await f.actor.query(api.projects.network.list, { workspaceId: f.workspaceId, paginationOpts })).page[0];
  expect(row).toEqual(detail);
  expect(row).toMatchObject({ memberRole: null, personalOrder: null, isFavorite: false, description: "" });
  expect(row.createdAt).toBeGreaterThan(0);
});
