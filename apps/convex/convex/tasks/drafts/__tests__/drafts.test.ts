import { signedIn } from "../../../../test-support/session";
import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { workspaceJourney } from "../../../../test-support/fixtures";
async function fixture() {
  const f = await workspaceJourney();
  const draftId = await f.owner.mutation(api.tasks.drafts.index.create, { workspaceId: f.workspaceId });
  const get = () => f.owner.query(api.tasks.drafts.index.resolve, { workspaceId: f.workspaceId, draftId });
  const draft = await get();
  const fields = {
    projectId: f.projectId,
    title: "Draft task",
    html: "<p>Hello</p>",
    status: draft.status,
    properties: draft.properties,
    parent: draft.parent,
    cycle: draft.cycle,
    modules: draft.modules,
  };
  return { ...f, draftId, get, fields };
}
test("draft stays private, saves blank until publish and CAS conflicts preserve stored content", async () => {
  const f = await fixture();
  expect((await f.get()).title).toBe("");
  const other = await f.t.run(async (ctx) => {
    const id = await ctx.db.insert("users", {});
    await ctx.db.insert("workspaceMembers", { workspaceId: f.workspaceId, userId: id, role: "admin", active: true });
    return id;
  });
  await expect(
    (await signedIn(f.t, other)).query(api.tasks.drafts.index.resolve, {
      workspaceId: f.workspaceId,
      draftId: f.draftId,
    })
  ).rejects.toThrow("not found");
  const d = await f.get();
  await f.owner.mutation(api.tasks.drafts.index.save, {
    draftId: f.draftId,
    expectedContentRevision: d.contentRevision,
    ...f.fields,
  });
  await expect(
    f.owner.mutation(api.tasks.drafts.index.save, {
      draftId: f.draftId,
      expectedContentRevision: d.contentRevision,
      ...f.fields,
      title: "Stale",
    })
  ).rejects.toThrow("changed");
  expect((await f.get()).title).toBe("Draft task");
});
test("publish atomically reuses task identity/default/subscription/content owners and retries once", async () => {
  const f = await fixture();
  const d = await f.get();
  await f.owner.mutation(api.tasks.drafts.index.save, {
    draftId: f.draftId,
    expectedContentRevision: d.contentRevision,
    ...f.fields,
    descriptionJson: { type: "doc" },
    descriptionBinary: new Uint8Array([1, 2]).buffer,
  });
  const saved = await f.get();
  const args = { draftId: f.draftId, expectedUpdatedAt: saved.updatedAt };
  const first = await f.owner.mutation(api.tasks.drafts.index.publish, args);
  expect(await f.owner.mutation(api.tasks.drafts.index.publish, args)).toEqual(first);
  const task = await f.owner.query(api.tasks.index.get, { taskId: first.taskId });
  expect(task.title).toBe("Draft task");
  expect(task.sequence).toBe(1);
  const content = await f.owner.query(api.tasks.description.get, { taskId: first.taskId });
  expect(content.descriptionJson).toEqual({ type: "doc" });
  expect(content.descriptionBinary).toEqual(new Uint8Array([1, 2]).buffer);
  await f.owner.mutation(api.tasks.description.save, {
    taskId: task._id,
    expectedUpdatedAt: task.updatedAt,
    html: "<p>Edited</p>",
  });
  const changed = await f.owner.query(api.tasks.description.get, { taskId: task._id });
  expect(changed.descriptionJson).toBeNull();
  expect(changed.descriptionBinary).toBeNull();
  expect(await f.t.run((ctx) => ctx.db.query("tasks").collect())).toHaveLength(1);
  expect(await f.t.run((ctx) => ctx.db.query("taskSubscriptions").collect())).toHaveLength(1);
});
test("draft soft removal recovery and copy preserve content while publication needs current writer", async () => {
  const f = await fixture();
  const d = await f.get();
  await f.owner.mutation(api.tasks.drafts.index.save, {
    draftId: f.draftId,
    expectedContentRevision: d.contentRevision,
    ...f.fields,
  });
  const saved = await f.get();
  const copyId = await f.owner.action(api.tasks.drafts.copy.run, {
    draftId: f.draftId,
    expectedUpdatedAt: saved.updatedAt,
  });
  expect(
    (await f.owner.query(api.tasks.drafts.index.resolve, { workspaceId: f.workspaceId, draftId: copyId })).html
  ).toBe(saved.html);
  await f.owner.mutation(api.tasks.drafts.index.lifecycle, {
    draftId: f.draftId,
    expectedUpdatedAt: saved.updatedAt,
    deleted: true,
  });
  const removed = await f.get();
  await expect(
    f.owner.mutation(api.tasks.drafts.index.publish, { draftId: f.draftId, expectedUpdatedAt: removed.updatedAt })
  ).rejects.toThrow("Restore");
  await f.owner.mutation(api.tasks.drafts.index.lifecycle, {
    draftId: f.draftId,
    expectedUpdatedAt: removed.updatedAt,
    deleted: false,
  });
  await f.t.run(async (ctx) => {
    const member = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", f.projectId).eq("userId", saved.authorId))
      .unique();
    if (member) await ctx.db.patch(member._id, { role: "guest" });
  });
  const restored = await f.get();
  expect(restored.canPublish).toBe(false);
  await expect(
    f.owner.mutation(api.tasks.drafts.index.publish, { draftId: f.draftId, expectedUpdatedAt: restored.updatedAt })
  ).rejects.toThrow("access");
  expect(await f.t.run((ctx) => ctx.db.query("tasks").collect())).toHaveLength(0);
});
test("publish commits parent/cycle/modules together and rolls back on stale relationship revisions", async () => {
  const f = await fixture();
  const parentId = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Parent" });
  const parent = await f.owner.query(api.tasks.index.get, { taskId: parentId });
  const cycleId = await f.owner.mutation(api.cycles.index.create, {
    projectId: f.projectId,
    name: "Cycle",
    description: "",
    startDate: null,
    endDate: null,
  });
  const moduleId = await f.owner.mutation(api.modules.index.create, {
    projectId: f.projectId,
    name: "Module",
    descriptionHtml: "<p></p>",
    startDate: null,
    targetDate: null,
    status: "planned",
    leadId: null,
  });
  const refs = await f.t.run(async (ctx) => ({ cycle: await ctx.db.get(cycleId), module: await ctx.db.get(moduleId) }));
  if (!refs.cycle || !refs.module) throw new Error("Missing relationship fixtures");
  const d = await f.get();
  const fields = {
    ...f.fields,
    parent: { taskId: parentId, expectedUpdatedAt: parent.updatedAt },
    cycle: { cycleId, expectedCycleUpdatedAt: refs.cycle.updatedAt },
    modules: [{ moduleId, expectedModuleUpdatedAt: refs.module.updatedAt }],
  };
  await f.owner.mutation(api.tasks.drafts.index.save, {
    draftId: f.draftId,
    expectedContentRevision: d.contentRevision,
    ...fields,
  });
  const saved = await f.get();
  await f.t.run((ctx) => ctx.db.patch(moduleId, { updatedAt: refs.module!.updatedAt + 1 }));
  await expect(
    f.owner.mutation(api.tasks.drafts.index.publish, { draftId: f.draftId, expectedUpdatedAt: saved.updatedAt })
  ).rejects.toThrow("changed");
  expect(await f.t.run((ctx) => ctx.db.query("tasks").collect())).toHaveLength(1);
  await f.owner.mutation(api.tasks.drafts.index.save, {
    draftId: f.draftId,
    expectedContentRevision: saved.contentRevision,
    ...fields,
    modules: [{ moduleId, expectedModuleUpdatedAt: refs.module.updatedAt + 1 }],
  });
  const fresh = await f.get();
  const published = await f.owner.mutation(api.tasks.drafts.index.publish, {
    draftId: f.draftId,
    expectedUpdatedAt: fresh.updatedAt,
  });
  expect((await f.owner.query(api.tasks.hierarchy.parent, { taskId: published.taskId })).task?._id).toBe(parentId);
  expect((await f.owner.query(api.cycles.tasks.current, { taskId: published.taskId }))?._id).toBe(cycleId);
  expect(await f.t.run((ctx) => ctx.db.query("moduleTasks").collect())).toHaveLength(1);
});
test("project removal requires explicit scoped-field clearing and revoked project drafts disappear", async () => {
  const f = await fixture();
  const parentId = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Parent" });
  const parent = await f.owner.query(api.tasks.index.get, { taskId: parentId });
  const d = await f.get();
  const fields = { ...f.fields, parent: { taskId: parentId, expectedUpdatedAt: parent.updatedAt } };
  await f.owner.mutation(api.tasks.drafts.index.save, {
    draftId: f.draftId,
    expectedContentRevision: d.contentRevision,
    ...fields,
  });
  const saved = await f.get();
  await expect(
    f.owner.mutation(api.tasks.drafts.index.save, {
      draftId: f.draftId,
      expectedContentRevision: saved.contentRevision,
      ...fields,
      projectId: null,
    })
  ).rejects.toThrow("project");
  await f.t.run(async (ctx) => {
    const member = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", f.projectId).eq("userId", saved.authorId))
      .unique();
    if (member) await ctx.db.patch(member._id, { active: false });
  });
  expect(
    (
      await f.owner.query(api.tasks.drafts.index.list, {
        workspaceId: f.workspaceId,
        deleted: false,
        paginationOpts: { numItems: 20, cursor: null },
      })
    ).page
  ).toHaveLength(0);
  await expect(f.get()).rejects.toThrow("unavailable");
});
