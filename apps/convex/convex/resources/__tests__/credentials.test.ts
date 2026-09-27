import { signedIn } from "../../../test-support/session";
import { expect, test, vi } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
const fields = {
  title: "Console",
  url: "https://example.com",
  description: "",
  category: "",
  projectId: null,
  documentId: null,
  clientId: null,
};
async function fixture() {
  const base = await workspaceJourney();
  const credentialId = await base.t.run((ctx) =>
    ctx.db.insert("mcpCredentials", {
      workspaceId: base.workspaceId,
      ownerId: base.userId,
      name: "Private token",
      accountIdentifier: "account",
      projectId: null,
      remoteWorkspaceSlug: "remote",
      remoteProjectId: null,
      status: "active",
      revision: 1,
    })
  );
  const readerId = await base.t.run((ctx) => ctx.db.insert("users", { name: "Reader" }));
  await base.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: base.workspaceId,
    userId: readerId,
    role: "admin",
  });
  return { ...base, credentialId, readerId, reader: await signedIn(base.t, readerId) };
}
test("workspace administration sees the resource but cannot discover or attach an ungranted credential", async () => {
  const f = await fixture();
  const resourceId = await f.owner.mutation(api.resources.index.create, {
    workspaceId: f.workspaceId,
    ...fields,
    credentialId: f.credentialId,
  });
  expect(await f.reader.query(api.resources.index.get, { resourceId })).toMatchObject({
    credentialId: null,
    credentialName: null,
    credentialUnavailable: true,
  });
  expect(
    (await f.reader.query(api.resources.index.detail, { workspaceId: f.workspaceId, resourceId })).resource.credentialId
  ).toBeNull();
  await expect(
    f.reader.mutation(api.resources.index.create, {
      workspaceId: f.workspaceId,
      ...fields,
      credentialId: f.credentialId,
    })
  ).rejects.toThrow("access denied");
  expect(
    (
      await f.reader.query(api.resources.index.list, {
        workspaceId: f.workspaceId,
        paginationOpts: { numItems: 10, cursor: null },
      })
    ).page
  ).toMatchObject([{ credentialId: null, credentialName: null, credentialUnavailable: true }]);
});
test("use-only metadata grantee can link/read without receiving secrets; expiry/revocation hides resource", async () => {
  const f = await fixture();
  const grantId = await f.t.run((ctx) =>
    ctx.db.insert("mcpGrants", {
      credentialId: f.credentialId,
      memberId: f.readerId,
      permission: "use",
      expiresAt: null,
      grantedBy: f.userId,
    })
  );
  const resourceId = await f.reader.mutation(api.resources.index.create, {
    workspaceId: f.workspaceId,
    ...fields,
    credentialId: f.credentialId,
  });
  const detail = await f.reader.query(api.resources.index.detail, { workspaceId: f.workspaceId, resourceId });
  expect(detail.resource.credentialName).toBe("Private token");
  expect(detail).not.toHaveProperty("secret");
  expect(detail).not.toHaveProperty("ciphertext");
  await f.t.run((ctx) => ctx.db.patch(grantId, { expiresAt: Date.now() - 1 }));
  expect(
    (
      await f.reader.query(api.resources.index.list, {
        workspaceId: f.workspaceId,
        paginationOpts: { numItems: 10, cursor: null },
      })
    ).page
  ).toMatchObject([{ credentialId: null, credentialName: null, credentialUnavailable: true }]);
  await f.reader.mutation(api.resources.index.update, {
    resourceId,
    expectedUpdatedAt: detail.resource.updatedAt,
    ...fields,
    title: "Preserve hidden association",
  });
  expect((await f.t.run((ctx) => ctx.db.get(resourceId)))?.credentialId).toBe(f.credentialId);
  const current = await f.reader.query(api.resources.index.get, { resourceId });
  await f.reader.mutation(api.resources.index.update, {
    resourceId,
    expectedUpdatedAt: current.updatedAt,
    ...fields,
    credentialId: null,
  });
  expect((await f.t.run((ctx) => ctx.db.get(resourceId)))?.credentialId).toBeNull();
});
test("cross-workspace references reject and project revocation/deletion deny current metadata visibility", async () => {
  const f = await fixture();
  const another = await f.owner.mutation(api.workspaces.index.create, { name: "Other", slug: "resource-other" });
  await expect(
    f.owner.mutation(api.resources.index.create, { workspaceId: another, ...fields, credentialId: f.credentialId })
  ).rejects.toThrow("another workspace");
  await f.t.run((ctx) => ctx.db.patch(f.credentialId, { projectId: f.projectId, remoteProjectId: "remote-project" }));
  await f.owner.mutation(api.projects.index.grantMember, {
    projectId: f.projectId,
    userId: f.readerId,
    role: "member",
  });
  await f.t.run((ctx) =>
    ctx.db.insert("mcpGrants", {
      credentialId: f.credentialId,
      memberId: f.readerId,
      permission: "view",
      expiresAt: null,
      grantedBy: f.userId,
    })
  );
  const resourceId = await f.reader.mutation(api.resources.index.create, {
    workspaceId: f.workspaceId,
    ...fields,
    credentialId: f.credentialId,
  });
  await f.owner.mutation(api.projects.index.revokeMember, { projectId: f.projectId, userId: f.readerId });
  expect(
    (
      await f.reader.query(api.resources.index.list, {
        workspaceId: f.workspaceId,
        paginationOpts: { numItems: 10, cursor: null },
      })
    ).page
  ).toMatchObject([{ credentialId: null, credentialName: null, credentialUnavailable: true }]);
  expect((await f.reader.query(api.resources.index.get, { resourceId })).credentialUnavailable).toBe(true);
  await f.t.run((ctx) => ctx.db.patch(f.credentialId, { status: "deleted" }));
  expect(
    (
      await f.owner.query(api.resources.index.list, {
        workspaceId: f.workspaceId,
        paginationOpts: { numItems: 10, cursor: null },
      })
    ).page
  ).toMatchObject([{ credentialId: null, credentialName: null, credentialUnavailable: true }]);
  await f.owner.mutation(api.resources.index.remove, { resourceId });
  expect((await f.t.run((ctx) => ctx.db.get(resourceId)))?.deleted).toBe(true);
});
test("older resource rows remain readable; omitted field preserves a link and explicit null detaches it", async () => {
  const f = await fixture();
  const resourceId = await f.owner.mutation(api.resources.index.create, {
    workspaceId: f.workspaceId,
    ...fields,
    credentialId: f.credentialId,
  });
  const before = await f.owner.query(api.resources.index.get, { resourceId });
  await f.owner.mutation(api.resources.index.update, {
    resourceId,
    expectedUpdatedAt: before.updatedAt,
    ...fields,
    title: "Renamed",
  });
  const preserved = await f.owner.query(api.resources.index.get, { resourceId });
  expect(preserved.credentialId).toBe(f.credentialId);
  await f.owner.mutation(api.resources.index.update, {
    resourceId,
    expectedUpdatedAt: preserved.updatedAt,
    ...fields,
    credentialId: null,
  });
  expect((await f.owner.query(api.resources.index.get, { resourceId })).credentialId).toBeNull();
  await f.t.run((ctx) => ctx.db.patch(resourceId, { credentialId: undefined }));
  expect(
    (await f.owner.query(api.resources.index.detail, { workspaceId: f.workspaceId, resourceId })).resource
      .credentialName
  ).toBeNull();
});

test("frozen-clock resource edits retain CAS and delete advances the same revision owner", async () => {
  const f = await fixture();
  const resourceId = await f.owner.mutation(api.resources.index.create, { workspaceId: f.workspaceId, ...fields });
  const initial = await f.owner.query(api.resources.index.get, { resourceId });
  const clock = vi.spyOn(Date, "now").mockReturnValue(initial.updatedAt);
  try {
    await f.owner.mutation(api.resources.index.update, {
      resourceId,
      expectedUpdatedAt: initial.updatedAt,
      ...fields,
      credentialId: f.credentialId,
    });
    const changed = await f.owner.query(api.resources.index.get, { resourceId });
    expect(changed.updatedAt).toBe(initial.updatedAt + 1);
    await expect(
      f.owner.mutation(api.resources.index.update, {
        resourceId,
        expectedUpdatedAt: initial.updatedAt,
        ...fields,
        credentialId: null,
      })
    ).rejects.toThrow("changed");
    expect((await f.owner.query(api.resources.index.get, { resourceId })).credentialId).toBe(f.credentialId);
    await f.owner.mutation(api.resources.index.remove, { resourceId });
    expect((await f.t.run((ctx) => ctx.db.get(resourceId)))?.updatedAt).toBe(changed.updatedAt + 1);
  } finally {
    clock.mockRestore();
  }
});
