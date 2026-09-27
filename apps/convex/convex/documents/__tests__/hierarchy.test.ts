import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
import { MAX_DOCUMENT_DEPTH, MAX_DOCUMENT_SUBTREE } from "../hierarchy";
const fields = {
  name: "Document",
  access: "public" as const,
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
};
const paginationOpts = { cursor: null, numItems: 10 };
async function fixture() {
  const f = await workspaceJourney();
  const parentId = await f.owner.mutation(api.documents.index.create, {
    workspaceId: f.workspaceId,
    ...fields,
    name: "Parent",
  });
  const childId = await f.owner.mutation(api.documents.index.create, {
    workspaceId: f.workspaceId,
    ...fields,
    name: "Child",
  });
  const move = async (documentId = childId, destination = parentId) => {
    const child = await f.owner.query(api.documents.index.get, { documentId });
    const parent = await f.owner.query(api.documents.index.get, { documentId: destination });
    return f.owner.mutation(api.documents.hierarchy.move, {
      documentId,
      parentId: destination,
      expectedUpdatedAt: child.updatedAt,
      expectedParentUpdatedAt: parent.updatedAt,
    });
  };
  return { ...f, parentId, childId, move };
}
test("moving preserves independent visibility and CRDT identity and captures both document revisions", async () => {
  const f = await fixture();
  const before = await f.owner.query(api.documents.index.get, { documentId: f.childId });
  const parent = await f.owner.query(api.documents.index.get, { documentId: f.parentId });
  await f.move();
  const after = await f.owner.query(api.documents.index.get, { documentId: f.childId });
  expect(after).toMatchObject({
    _id: before._id,
    access: before.access,
    projectIds: before.projectIds,
    revision: before.revision,
  });
  expect(after.updatedAt).toBeGreaterThan(before.updatedAt);
  expect(
    (await f.owner.query(api.documents.hierarchy.children, { documentId: f.parentId, paginationOpts })).page.map(
      (row) => row._id
    )
  ).toEqual([f.childId]);
  await expect(
    f.owner.mutation(api.documents.hierarchy.move, {
      documentId: f.childId,
      parentId: f.parentId,
      expectedUpdatedAt: before.updatedAt,
      expectedParentUpdatedAt: parent.updatedAt,
    })
  ).rejects.toThrow("changed");
  await f.owner.mutation(api.documents.index.setLifecycle, {
    documentId: f.parentId,
    expectedUpdatedAt: parent.updatedAt,
    isLocked: false,
    archived: false,
    deleted: false,
  });
  await expect(
    f.owner.mutation(api.documents.hierarchy.move, {
      documentId: f.childId,
      parentId: f.parentId,
      expectedUpdatedAt: after.updatedAt,
      expectedParentUpdatedAt: parent.updatedAt,
    })
  ).rejects.toThrow("changed");
  expect(await f.t.run((ctx) => ctx.db.query("documentParents").collect())).toHaveLength(1);
});
test("private parents do not grant or revoke child access, unreadable children remain hidden and deleted parents can be detached", async () => {
  const f = await fixture();
  await f.t.run((ctx) => ctx.db.patch(f.parentId, { access: "private" }));
  await f.move();
  const memberId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Member" }));
  const member = await signedIn(f.t, memberId);
  await f.t.run((ctx) =>
    ctx.db.insert("workspaceMembers", { workspaceId: f.workspaceId, userId: memberId, role: "member", active: true })
  );
  expect(await member.query(api.documents.hierarchy.parent, { documentId: f.childId })).toEqual({
    hasParent: true,
    parent: null,
  });
  expect(
    (await member.query(api.documents.index.list, { workspaceId: f.workspaceId, paginationOpts })).page.map(
      (row) => row._id
    )
  ).toContain(f.childId);
  await expect(
    member.query(api.documents.hierarchy.children, { documentId: f.parentId, paginationOpts })
  ).rejects.toThrow("denied");
  await f.t.run((ctx) => ctx.db.patch(f.parentId, { deleted: true }));
  const child = await member.query(api.documents.index.get, { documentId: f.childId });
  await member.mutation(api.documents.hierarchy.move, {
    documentId: f.childId,
    expectedUpdatedAt: child.updatedAt,
    parentId: null,
    expectedParentUpdatedAt: null,
  });
  expect(await member.query(api.documents.hierarchy.parent, { documentId: f.childId })).toEqual({
    hasParent: false,
    parent: null,
  });
});
test("hierarchy rejects cycles, foreign workspace moves and locked endpoints atomically", async () => {
  const f = await fixture();
  await f.move();
  await expect(f.move(f.parentId, f.childId)).rejects.toThrow("descendants");
  const foreignWorkspace = await f.owner.mutation(api.workspaces.index.create, { name: "Foreign", slug: "foreign" });
  const foreign = await f.owner.mutation(api.documents.index.create, { workspaceId: foreignWorkspace, ...fields });
  await expect(f.move(f.childId, foreign)).rejects.toThrow("same workspace");
  await f.t.run((ctx) => ctx.db.patch(f.parentId, { isLocked: true }));
  await expect(f.move()).rejects.toThrow("locked");
  expect((await f.owner.query(api.documents.hierarchy.parent, { documentId: f.childId })).parent?.id).toBe(f.parentId);
});
test("depth includes an existing subtree and oversized subtree moves fail without changing links", async () => {
  const f = await fixture();
  let parentId = f.parentId;
  for (let index = 1; index < MAX_DOCUMENT_DEPTH; index++) {
    // Build each level from the previous level to exercise the depth boundary.
    // oxlint-disable-next-line no-await-in-loop
    const next = await f.owner.mutation(api.documents.index.create, { workspaceId: f.workspaceId, ...fields });
    // oxlint-disable-next-line no-await-in-loop
    await f.move(next, parentId);
    parentId = next;
  }
  await expect(f.move(f.childId, parentId)).rejects.toThrow("levels");
  await f.t.run(async (ctx) => {
    const document = await ctx.db.get(f.childId);
    if (!document) throw new Error("Fixture document missing");
    const { _id, _creationTime, ...stored } = document;
    await Promise.all(
      Array.from({ length: MAX_DOCUMENT_SUBTREE }, async () => {
        const child = await ctx.db.insert("documents", stored);
        await ctx.db.insert("documentParents", { documentId: child, parentId: f.childId });
      })
    );
  });
  await expect(f.move()).rejects.toThrow("subtree");
  expect(await f.owner.query(api.documents.hierarchy.parent, { documentId: f.childId })).toEqual({
    hasParent: false,
    parent: null,
  });
});
