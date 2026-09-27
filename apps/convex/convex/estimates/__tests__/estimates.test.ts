import { expect, test } from "vitest";
import { api, internal } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { initialProperties } from "../../tasks/properties";
async function fixture() {
  const f = await workspaceJourney();
  const systemId = await f.owner.mutation(api.estimates.index.create, {
    projectId: f.projectId,
    name: "Points",
    description: "",
    type: "points",
    points: [
      { key: 0, value: "1", description: "Small" },
      { key: 1, value: "3", description: "Medium" },
    ],
  });
  await f.owner.mutation(api.estimates.index.select, { projectId: f.projectId, systemId, expectedRevision: 0 });
  const system = await f.owner.query(api.estimates.index.get, { systemId });
  const properties = { ...initialProperties, estimatePointId: system.points[0]._id };
  const { completedAt, ...props } = properties;
  return { ...f, system, props };
}
test("systems/points preserve scope, current writer permission, unique names and revision conflicts", async () => {
  const f = await fixture();
  await expect(
    f.owner.mutation(api.estimates.index.create, {
      projectId: f.projectId,
      name: "Points",
      description: "",
      type: "points",
      points: [{ key: 0, value: "1", description: "" }],
    })
  ).rejects.toThrow("exists");
  await f.owner.mutation(api.estimates.index.updatePoint, {
    pointId: f.system.points[0]._id,
    expectedRevision: 0,
    key: 0,
    value: "2",
    description: "Updated",
  });
  await expect(
    f.owner.mutation(api.estimates.index.updatePoint, {
      pointId: f.system.points[0]._id,
      expectedRevision: 0,
      key: 0,
      value: "4",
      description: "Stale",
    })
  ).rejects.toThrow("changed");
  await f.t.run(async (ctx) => {
    const member = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", f.projectId).eq("userId", f.userId))
      .unique();
    if (member) await ctx.db.patch(member._id, { role: "guest" });
  });
  expect((await f.owner.query(api.estimates.selection.choices, { projectId: f.projectId })).canAssign).toBe(false);
  await expect(
    f.owner.mutation(api.estimates.index.select, { projectId: f.projectId, systemId: null, expectedRevision: 1 })
  ).rejects.toThrow("access");
});
test("system switches preserve prior task assignment but reject new assignments and stale draft publication", async () => {
  const f = await fixture();
  const taskId = await f.owner.mutation(api.tasks.index.create, {
    projectId: f.projectId,
    title: "Existing",
    properties: f.props,
  });
  const draftId = await f.owner.mutation(api.tasks.drafts.index.create, { workspaceId: f.workspaceId });
  const draft = await f.owner.query(api.tasks.drafts.index.resolve, { workspaceId: f.workspaceId, draftId });
  await f.owner.mutation(api.tasks.drafts.index.save, {
    draftId,
    expectedContentRevision: draft.contentRevision,
    projectId: f.projectId,
    title: "Draft",
    html: "<p></p>",
    status: null,
    properties: f.props,
    parent: null,
    cycle: null,
    modules: [],
  });
  const next = await f.owner.mutation(api.estimates.index.create, {
    projectId: f.projectId,
    name: "Categories",
    description: "",
    type: "categories",
    points: [{ key: 0, value: "S", description: "" }],
  });
  await f.owner.mutation(api.estimates.index.select, { projectId: f.projectId, systemId: next, expectedRevision: 1 });
  await expect(
    f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Rejected", properties: f.props })
  ).rejects.toThrow("active");
  const task = await f.owner.query(api.tasks.index.get, { taskId });
  await f.owner.mutation(api.tasks.index.update, {
    taskId,
    expectedUpdatedAt: task.updatedAt,
    title: "Retained",
    description: task.description,
    status: task.status,
    ...f.props,
  });
  expect((await f.owner.query(api.estimates.selection.forTask, { taskId }))?.point._id).toBe(f.props.estimatePointId);
  const saved = await f.owner.query(api.tasks.drafts.index.resolve, { workspaceId: f.workspaceId, draftId });
  await expect(
    f.owner.mutation(api.tasks.drafts.index.publish, { draftId, expectedUpdatedAt: saved.updatedAt })
  ).rejects.toThrow("active");
});
test("replacement advances bounded task/draft pages once and rejects revoked resumptions", async () => {
  const f = await fixture();
  await Promise.all(
    Array.from({ length: 23 }, (_, i) =>
      f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: `Task ${i}`, properties: f.props })
    )
  );
  const draftId = await f.owner.mutation(api.tasks.drafts.index.create, { workspaceId: f.workspaceId });
  const draft = await f.owner.query(api.tasks.drafts.index.resolve, { workspaceId: f.workspaceId, draftId });
  await f.owner.mutation(api.tasks.drafts.index.save, {
    draftId,
    expectedContentRevision: draft.contentRevision,
    projectId: f.projectId,
    title: "Draft",
    html: "<p></p>",
    status: null,
    properties: f.props,
    parent: null,
    cycle: null,
    modules: [],
  });
  const before = await f.owner.query(api.tasks.drafts.index.resolve, { workspaceId: f.workspaceId, draftId });
  const jobId = await f.owner.mutation(api.estimates.remap.begin, {
    systemId: f.system._id,
    pointId: f.system.points[0]._id,
    expectedSystemRevision: 0,
    expectedPointRevision: 0,
    replacementId: f.system.points[1]._id,
  });
  await expect(
    f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Retiring", properties: f.props })
  ).rejects.toThrow("active");
  const first = await f.owner.mutation(api.estimates.remap.page, { jobId, expectedRevision: 0 });
  expect(first.changed).toBe(20);
  expect(first.phase).toBe("tasks");
  await expect(f.owner.mutation(api.estimates.remap.page, { jobId, expectedRevision: 0 })).rejects.toThrow("changed");
  const membership = await f.t.run(async (ctx) => {
    const row = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", f.projectId).eq("userId", f.userId))
      .unique();
    if (!row) throw new Error("Missing member");
    await ctx.db.patch(row._id, { active: false });
    return row._id;
  });
  await expect(f.owner.mutation(api.estimates.remap.page, { jobId, expectedRevision: first.revision })).rejects.toThrow(
    "access"
  );
  await f.t.run((ctx) => ctx.db.patch(membership, { active: true }));
  const second = await f.owner.mutation(api.estimates.remap.page, { jobId, expectedRevision: first.revision });
  expect(second.phase).toBe("drafts");
  const final = await f.owner.mutation(api.estimates.remap.page, { jobId, expectedRevision: second.revision });
  expect(final.phase).toBe("complete");
  expect(final.changed).toBe(24);
  expect(await f.owner.mutation(api.estimates.remap.page, { jobId, expectedRevision: 0 })).toEqual(final);
  const after = await f.owner.query(api.tasks.drafts.index.resolve, { workspaceId: f.workspaceId, draftId });
  expect(after.properties.estimatePointId).toBe(f.system.points[1]._id);
  expect(after.contentRevision).toBe(before.contentRevision + 1);
  await expect(
    f.owner.mutation(api.tasks.drafts.index.publish, { draftId, expectedUpdatedAt: before.updatedAt })
  ).rejects.toThrow("changed");
  expect(
    (await f.owner.query(api.estimates.index.get, { systemId: f.system._id })).points.map((point) => point.key)
  ).toEqual([0]);
});
test("bounded reference migration initializes only missing fields and is idempotent", async () => {
  const f = await fixture();
  const taskId = await f.owner.mutation(api.tasks.index.create, {
    projectId: f.projectId,
    title: "Preserve",
    properties: f.props,
  });
  const old = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Old" });
  await f.t.run((ctx) => ctx.db.patch(old, { estimatePointId: undefined }));
  const first = await f.t.mutation(internal.estimates.migrations.references, { table: "tasks", cursor: null });
  expect(first.changed).toBe(1);
  expect((await f.t.mutation(internal.estimates.migrations.references, { table: "tasks", cursor: null })).changed).toBe(
    0
  );
  expect((await f.owner.query(api.tasks.index.get, { taskId })).estimatePointId).toBe(f.props.estimatePointId);
});
test("foreign project points reject and whole-system deletion clears references and active selection", async () => {
  const f = await fixture();
  const other = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Other",
    identifier: "OTHER",
  });
  await expect(
    f.owner.mutation(api.tasks.index.create, { projectId: other, title: "Wrong scope", properties: f.props })
  ).rejects.toThrow("project");
  await expect(
    f.owner.mutation(api.estimates.index.select, { projectId: other, systemId: f.system._id, expectedRevision: 0 })
  ).rejects.toThrow("another project");
  const taskId = await f.owner.mutation(api.tasks.index.create, {
    projectId: f.projectId,
    title: "Clear estimate",
    properties: f.props,
  });
  const jobId = await f.owner.mutation(api.estimates.remap.begin, {
    systemId: f.system._id,
    pointId: null,
    expectedSystemRevision: 0,
    expectedPointRevision: null,
    replacementId: null,
  });
  const tasks = await f.owner.mutation(api.estimates.remap.page, { jobId, expectedRevision: 0 });
  await f.owner.mutation(api.estimates.remap.page, { jobId, expectedRevision: tasks.revision });
  expect((await f.owner.query(api.tasks.index.get, { taskId })).estimatePointId).toBeNull();
  expect((await f.owner.query(api.estimates.index.list, { projectId: f.projectId })).config?.activeSystemId).toBeNull();
  await expect(f.owner.query(api.estimates.index.get, { systemId: f.system._id })).rejects.toThrow("not found");
});
