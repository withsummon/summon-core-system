import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
const paginationOpts = { cursor: null, numItems: 10 };
async function fixture() {
  const f = await workspaceJourney();
  const documentId = await f.owner.mutation(api.documents.index.create, {
    workspaceId: f.workspaceId,
    name: "Knowledge",
    access: "public",
    isGlobal: true,
    projectIds: [],
    color: "",
    viewProps: {},
    logoProps: {},
    sortOrder: 0,
    category: "document",
    tags: ["separate"],
    clientId: null,
    opportunityId: null,
    externalId: null,
    externalSource: null,
  });
  const projectId = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Taxonomy",
    identifier: "TAX",
  });
  const labelId = await f.owner.mutation(api.tasks.labels.save, {
    parentId: null,
    projectId,
    data: { name: "Reference", description: "", color: "blue", sortOrder: 0 },
  });
  const get = () => f.owner.query(api.documents.index.get, { documentId });
  return { ...f, documentId, projectId, labelId, get };
}
test("attach accessible workspace project taxonomy without changing document projects, tags or content; reject stale change", async () => {
  const f = await fixture();
  const before = await f.get();
  await f.owner.mutation(api.documents.labels.set, {
    documentId: f.documentId,
    labelId: f.labelId,
    assigned: true,
    expectedUpdatedAt: before.updatedAt,
  });
  const after = await f.get();
  expect(after.tags).toEqual(before.tags);
  expect(after.projectIds).toEqual([]);
  expect(after.revision).toBe(before.revision);
  const rows = await f.owner.query(api.documents.labels.list, { documentId: f.documentId, paginationOpts });
  expect(rows.page[0].label?.name).toBe("Reference");
  await expect(
    f.owner.mutation(api.documents.labels.set, {
      documentId: f.documentId,
      labelId: f.labelId,
      assigned: false,
      expectedUpdatedAt: before.updatedAt,
    })
  ).rejects.toThrow("changed");
});
test("hide revoked taxonomy titles while permitting removal of retained links; reject new unavailable and locked changes", async () => {
  const f = await fixture();
  const initial = await f.get();
  await f.owner.mutation(api.documents.labels.set, {
    documentId: f.documentId,
    labelId: f.labelId,
    assigned: true,
    expectedUpdatedAt: initial.updatedAt,
  });
  await f.t.run((ctx) => ctx.db.patch(f.projectId, { archived: true }));
  expect(
    (await f.owner.query(api.documents.labels.list, { documentId: f.documentId, paginationOpts })).page[0]
  ).toEqual({ labelId: f.labelId, label: null });
  await f.owner.mutation(api.documents.labels.set, {
    documentId: f.documentId,
    labelId: f.labelId,
    assigned: false,
    expectedUpdatedAt: (await f.get()).updatedAt,
  });
  await expect(
    f.owner.mutation(api.documents.labels.set, {
      documentId: f.documentId,
      labelId: f.labelId,
      assigned: true,
      expectedUpdatedAt: (await f.get()).updatedAt,
    })
  ).rejects.toThrow("unavailable");
  await f.t.run((ctx) => ctx.db.patch(f.documentId, { isLocked: true }));
  await expect(
    f.owner.mutation(api.documents.labels.set, {
      documentId: f.documentId,
      labelId: f.labelId,
      assigned: true,
      expectedUpdatedAt: (await f.get()).updatedAt,
    })
  ).rejects.toThrow("locked");
});
test("foreign-workspace and newly guessed unavailable labels cannot be attached", async () => {
  const f = await fixture();
  const foreignWorkspaceId = await f.owner.mutation(api.workspaces.index.create, {
    name: "Foreign",
    slug: "foreign-labels",
  });
  const foreignProjectId = await f.owner.mutation(api.projects.index.create, {
    workspaceId: foreignWorkspaceId,
    name: "Foreign",
    identifier: "FOREIGN",
  });
  const foreignLabelId = await f.owner.mutation(api.tasks.labels.save, {
    parentId: null,
    projectId: foreignProjectId,
    data: { name: "Hidden", description: "", color: "", sortOrder: 0 },
  });
  await expect(
    f.owner.mutation(api.documents.labels.set, {
      documentId: f.documentId,
      labelId: foreignLabelId,
      assigned: true,
      expectedUpdatedAt: (await f.get()).updatedAt,
    })
  ).rejects.toThrow("unavailable");
  expect((await f.owner.query(api.documents.labels.list, { documentId: f.documentId, paginationOpts })).page).toEqual(
    []
  );
});
