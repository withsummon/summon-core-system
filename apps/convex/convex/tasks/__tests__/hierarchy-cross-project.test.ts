import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
const paginationOpts = { cursor: null, numItems: 10 };
async function fixture() {
  const f = await workspaceJourney();
  const otherProject = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Other",
    identifier: "OTH",
  });
  const parentId = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Parent" });
  const parent = await f.owner.query(api.tasks.index.get, { taskId: parentId });
  const childId = await f.owner.mutation(api.tasks.index.create, {
    projectId: otherProject,
    title: "Child",
    parent: { taskId: parentId, expectedUpdatedAt: parent.updatedAt },
  });
  return { ...f, otherProject, parentId, childId };
}
test("cross-project creation shares workspace, returns canonical route identity and rejects ancestor cycles", async () => {
  const f = await fixture();
  const parent = await f.owner.query(api.tasks.hierarchy.parent, { taskId: f.childId });
  expect(parent.project?.identifier).toBe("DLV");
  expect(parent.canUnlink).toBe(true);
  const children = await f.owner.query(api.tasks.hierarchy.children, { taskId: f.parentId, paginationOpts });
  expect(children.page[0]).toMatchObject({ _id: f.childId, project: { identifier: "OTH" }, canUnlink: true });
  const [a, b] = await Promise.all([
    f.owner.query(api.tasks.index.get, { taskId: f.parentId }),
    f.owner.query(api.tasks.index.get, { taskId: f.childId }),
  ]);
  await expect(
    f.owner.mutation(api.tasks.hierarchy.setParent, {
      taskId: a._id,
      expectedUpdatedAt: a.updatedAt,
      parent: { taskId: b._id, expectedUpdatedAt: b.updatedAt },
    })
  ).rejects.toThrow("own ancestor");
  expect((await f.owner.query(api.tasks.hierarchy.parent, { taskId: f.parentId })).hasParent).toBe(false);
});
test("revoked endpoint access hides content and denies reparent/unlink without silently removing the edge", async () => {
  const f = await fixture();
  const userId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Writer" }));
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role: "member" });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.otherProject, userId, role: "member" });
  const actor = await signedIn(f.t, userId);
  const child = await actor.query(api.tasks.index.get, { taskId: f.childId });
  const hidden = await actor.query(api.tasks.hierarchy.parent, { taskId: f.childId });
  expect(hidden).toMatchObject({ task: null, project: null, hasParent: true, canUnlink: false });
  await expect(
    actor.mutation(api.tasks.hierarchy.setParent, {
      taskId: child._id,
      expectedUpdatedAt: child.updatedAt,
      parent: null,
    })
  ).rejects.toThrow("access");
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId, role: "member" });
  expect((await actor.query(api.tasks.hierarchy.children, { taskId: f.parentId, paginationOpts })).page).toHaveLength(
    1
  );
  await f.owner.mutation(api.projects.index.revokeMember, { projectId: f.otherProject, userId });
  expect((await actor.query(api.tasks.hierarchy.children, { taskId: f.parentId, paginationOpts })).page).toHaveLength(
    0
  );
  await expect(
    actor.mutation(api.tasks.hierarchy.setParent, {
      taskId: child._id,
      expectedUpdatedAt: child.updatedAt,
      parent: null,
    })
  ).rejects.toThrow("access");
});
test("deleted parent remains recoverable and authorized child-side cleanup retains both tasks", async () => {
  const f = await fixture();
  const parent = await f.owner.query(api.tasks.index.get, { taskId: f.parentId });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.parentId,
    expectedUpdatedAt: parent.updatedAt,
    operation: "delete",
  });
  const hidden = await f.owner.query(api.tasks.hierarchy.parent, { taskId: f.childId });
  expect(hidden).toMatchObject({ task: null, project: null, hasParent: true, canUnlink: true });
  const child = await f.owner.query(api.tasks.index.get, { taskId: f.childId });
  await f.owner.mutation(api.tasks.hierarchy.setParent, {
    taskId: f.childId,
    expectedUpdatedAt: child.updatedAt,
    parent: null,
  });
  expect((await f.owner.query(api.tasks.hierarchy.parent, { taskId: f.childId })).hasParent).toBe(false);
  expect(await f.t.run((ctx) => ctx.db.get(f.parentId))).not.toBeNull();
});
test("archived parent project requires explicit project recovery before cross-project cleanup", async () => {
  const f = await fixture();
  const metadata = await f.owner.query(api.projects.settings.get, { projectId: f.projectId });
  await f.owner.mutation(api.projects.settings.setArchived, {
    projectId: f.projectId,
    expectedRevision: metadata.revision,
    archived: true,
  });
  expect(await f.owner.query(api.tasks.hierarchy.parent, { taskId: f.childId })).toMatchObject({
    task: null,
    project: null,
    canUnlink: false,
    hasParent: true,
  });
  const child = await f.owner.query(api.tasks.index.get, { taskId: f.childId });
  await expect(
    f.owner.mutation(api.tasks.hierarchy.setParent, {
      taskId: f.childId,
      expectedUpdatedAt: child.updatedAt,
      parent: null,
    })
  ).rejects.toThrow();
  await f.owner.mutation(api.projects.settings.setArchived, {
    projectId: f.projectId,
    expectedRevision: metadata.revision + 1,
    archived: false,
  });
  await f.owner.mutation(api.tasks.hierarchy.setParent, {
    taskId: f.childId,
    expectedUpdatedAt: child.updatedAt,
    parent: null,
  });
  expect((await f.owner.query(api.tasks.hierarchy.parent, { taskId: f.childId })).hasParent).toBe(false);
});
