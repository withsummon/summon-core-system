import { signedIn } from "../../../test-support/session";
import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";

async function deletedDocument() {
  const fixture = await workspaceJourney();
  const { owner, workspaceId, projectId } = fixture;
  const documentId = await owner.mutation(api.documents.index.create, {
    workspaceId,
    name: "Recovery notes",
    access: "private",
    isGlobal: false,
    projectIds: [projectId],
    color: "",
    viewProps: { retained: true },
    logoProps: {},
    sortOrder: 0,
    category: "document",
    tags: [],
    clientId: null,
    opportunityId: null,
    externalId: null,
    externalSource: null,
  });
  const binary = new Uint8Array([1, 2, 3]).buffer;
  await owner.mutation(api.documents.index.saveSnapshot, {
    documentId,
    expectedRevision: 0,
    descriptionBinary: binary,
    descriptionHtml: "<p>Retained</p>",
    descriptionJson: {},
  });
  await owner.mutation(api.documents.index.setLifecycle, {
    expectedUpdatedAt: (await owner.query(api.documents.index.get, { documentId })).updatedAt,
    documentId,
    isLocked: true,
    archived: true,
    deleted: true,
  });
  const record = await fixture.t.run((ctx) => ctx.db.get(documentId));
  return { ...fixture, documentId, binary, expectedUpdatedAt: record!.updatedAt };
}

test("deleted documents are owner-visible only in Trash and restore exact revisions and restrictions", async () => {
  const { owner, workspaceId, documentId, binary, expectedUpdatedAt } = await deletedDocument();
  const paginationOpts = { numItems: 10, cursor: null };
  expect((await owner.query(api.documents.index.list, { workspaceId, paginationOpts })).page).toEqual([]);
  expect(
    (await owner.query(api.documents.lifecycle.trash, { workspaceId, paginationOpts })).page.map((d) => d._id)
  ).toEqual([documentId]);
  await expect(owner.query(api.documents.index.snapshot, { documentId })).rejects.toThrow("not found");
  await owner.mutation(api.documents.lifecycle.restore, { documentId, expectedUpdatedAt });
  expect(await owner.query(api.documents.index.get, { documentId })).toMatchObject({
    revision: 1,
    access: "private",
    isLocked: true,
    archived: true,
    deleted: false,
    viewProps: { retained: true },
  });
  expect((await owner.query(api.documents.index.snapshot, { documentId }))?.descriptionBinary).toEqual(binary);
  expect((await owner.query(api.documents.lifecycle.trash, { workspaceId, paginationOpts })).page).toEqual([]);
  await expect(owner.mutation(api.documents.lifecycle.restore, { documentId, expectedUpdatedAt })).rejects.toThrow(
    "changed"
  );
});

test("workspace administrators cannot list or restore another owner's Trash", async () => {
  const { t, owner, workspaceId, documentId, expectedUpdatedAt } = await deletedDocument();
  const userId = await t.run((ctx) => ctx.db.insert("users", { name: "Other admin" }));
  await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "admin" });
  const other = await signedIn(t, userId);
  expect(
    (await other.query(api.documents.lifecycle.trash, { workspaceId, paginationOpts: { numItems: 10, cursor: null } }))
      .page
  ).toEqual([]);
  await expect(other.mutation(api.documents.lifecycle.restore, { documentId, expectedUpdatedAt })).rejects.toThrow(
    "Only the owner"
  );
  await expect(
    t.query(api.documents.lifecycle.trash, { workspaceId, paginationOpts: { numItems: 10, cursor: null } })
  ).rejects.toThrow("Sign in");
});

test("restoration checks current workspace write membership and rejects stale Trash records", async () => {
  const { t, owner, workspaceId, userId, documentId, expectedUpdatedAt } = await deletedDocument();
  await expect(
    owner.mutation(api.documents.lifecycle.restore, { documentId, expectedUpdatedAt: expectedUpdatedAt - 1 })
  ).rejects.toThrow("changed");
  const membership = await t.run((ctx) =>
    ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", userId))
      .unique()
  );
  await t.run((ctx) => ctx.db.patch(membership!._id, { role: "guest" }));
  await expect(owner.mutation(api.documents.lifecycle.restore, { documentId, expectedUpdatedAt })).rejects.toThrow(
    "access"
  );
  await t.run((ctx) => ctx.db.patch(membership!._id, { active: false }));
  await expect(
    owner.query(api.documents.lifecycle.trash, { workspaceId, paginationOpts: { numItems: 10, cursor: null } })
  ).rejects.toThrow("access");
  expect((await t.run((ctx) => ctx.db.get(documentId)))?.deleted).toBe(true);
});
