import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { initialProperties } from "../properties";
const data = { name: "Group", description: "", color: "#123456", sortOrder: 0 };
async function fixture() {
  const f = await workspaceJourney();
  const parentId = await f.owner.mutation(api.tasks.labels.save, { projectId: f.projectId, parentId: null, data });
  const childId = await f.owner.mutation(api.tasks.labels.save, {
    projectId: f.projectId,
    parentId,
    data: { ...data, name: "Child", sortOrder: 1 },
  });
  return { ...f, parentId, childId };
}
test("case-insensitive uniqueness, stale metadata and cyclic group edits reject without changes", async () => {
  const f = await fixture();
  await expect(
    f.owner.mutation(api.tasks.labels.save, {
      projectId: f.projectId,
      parentId: null,
      data: { ...data, name: "group" },
    })
  ).rejects.toThrow("already exists");
  await expect(
    f.owner.mutation(api.tasks.labels.save, {
      projectId: f.projectId,
      labelId: f.parentId,
      parentId: f.childId,
      expectedRevision: 0,
      data,
    })
  ).rejects.toThrow("ancestors");
  await f.owner.mutation(api.tasks.labels.save, {
    projectId: f.projectId,
    labelId: f.childId,
    parentId: null,
    expectedRevision: 0,
    data: { ...data, name: "Child" },
  });
  await expect(
    f.owner.mutation(api.tasks.labels.save, {
      projectId: f.projectId,
      labelId: f.childId,
      parentId: f.parentId,
      expectedRevision: 0,
      data: { ...data, name: "Stale" },
    })
  ).rejects.toThrow("changed");
});
test("removal freezes the group then resumes bounded cleanup across tasks, drafts, documents and saved filters", async () => {
  const f = await fixture();
  const { completedAt, ...properties } = initialProperties;
  const taskId = await f.owner.mutation(api.tasks.index.create, {
    projectId: f.projectId,
    title: "Tagged",
    properties: { ...properties, labelIds: [f.childId] },
  });
  const draftId = await f.owner.mutation(api.tasks.drafts.index.create, { workspaceId: f.workspaceId });
  await f.t.run((ctx) =>
    ctx.db.patch(draftId, { projectId: f.projectId, properties: { ...properties, labelIds: [f.childId] } })
  );
  const documentId = await f.owner.mutation(api.documents.index.create, {
    workspaceId: f.workspaceId,
    name: "Doc",
    access: "public",
    isGlobal: true,
    projectIds: [],
    color: "",
    viewProps: {},
    logoProps: {},
    sortOrder: 0,
    category: "document",
    tags: [],
    clientId: null,
    opportunityId: null,
    externalId: null,
    externalSource: null,
  });
  await f.owner.mutation(api.documents.labels.set, {
    documentId,
    labelId: f.childId,
    assigned: true,
    expectedUpdatedAt: (await f.owner.query(api.documents.index.get, { documentId })).updatedAt,
  });
  const viewId = await f.owner.mutation(api.savedViews.workspace.create, {
    workspaceId: f.workspaceId,
    name: "Tagged",
    description: "",
    filters: {
      match: "all",
      statuses: [],
      stateIds: [],
      priorities: [],
      assigneeIds: [],
      labelIds: [f.childId],
      creatorIds: [],
      startDate: null,
      targetDate: null,
    },
  });
  const jobId = await f.owner.mutation(api.tasks.label_removal.begin, { labelId: f.parentId, expectedRevision: 0 });
  expect((await f.owner.query(api.savedViews.workspace.get, { viewId })).selections.labels).toEqual([
    { id: f.childId, name: null },
  ]);
  await expect(
    f.owner.mutation(api.tasks.index.create, {
      projectId: f.projectId,
      title: "Late",
      properties: { ...properties, labelIds: [f.childId] },
    })
  ).rejects.toThrow("unavailable");
  await f.owner.mutation(api.tasks.label_removal.step, { jobId });
  await expect(f.owner.mutation(api.tasks.label_removal.cancel, { jobId })).rejects.toThrow("Continue");
  for (let page = 0; page < 10; page++) {
    // Each continuation consumes the cursor committed by the preceding page.
    // oxlint-disable-next-line no-await-in-loop
    const result = await f.owner.mutation(api.tasks.label_removal.step, { jobId });
    if (result.done) break;
  }
  expect((await f.owner.query(api.tasks.index.get, { taskId })).labelIds).toEqual([]);
  expect(
    (await f.owner.query(api.tasks.drafts.index.resolve, { workspaceId: f.workspaceId, draftId })).properties.labelIds
  ).toEqual([]);
  expect(
    (await f.owner.query(api.documents.labels.list, { documentId, paginationOpts: { cursor: null, numItems: 10 } }))
      .page
  ).toEqual([]);
  expect((await f.owner.query(api.savedViews.workspace.get, { viewId })).view.filters.labelIds).toEqual([]);
  expect(await f.t.run((ctx) => ctx.db.get(f.childId))).toBeNull();
});
test("cancel before cleanup restores active labels and advances metadata revision", async () => {
  const f = await fixture();
  const jobId = await f.owner.mutation(api.tasks.label_removal.begin, { labelId: f.parentId, expectedRevision: 0 });
  await f.owner.mutation(api.tasks.label_removal.cancel, { jobId });
  expect(await f.t.run((ctx) => ctx.db.get(f.childId))).toMatchObject({ retiring: false, revision: 2 });
});
