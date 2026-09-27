import { signedIn } from "../../../test-support/session";
import { describe, expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";

const details = {
  title: "Design",
  url: "https://example.com/design",
  description: "Reference",
  category: "design",
  documentId: null,
  clientId: null,
};
describe("external resource links", () => {
  test("a private document link remains hidden from another project member", async () => {
    const { t, owner, workspaceId, projectId } = await workspaceJourney();
    const userId = await t.run((ctx) => ctx.db.insert("users", { name: "Reader" }));
    const reader = await signedIn(t, userId);
    await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "member" });
    await owner.mutation(api.projects.index.grantMember, { projectId, userId, role: "member" });
    const documentId = await owner.mutation(api.documents.index.create, {
      workspaceId,
      projectIds: [projectId],
      name: "Private",
      access: "private",
      isGlobal: false,
      color: "",
      viewProps: {},
      logoProps: {},
      sortOrder: 1,
      category: "",
      tags: [],
      clientId: null,
      opportunityId: null,
      externalId: null,
      externalSource: null,
    });
    const resourceId = await owner.mutation(api.resources.index.create, {
      workspaceId,
      projectId,
      ...details,
      documentId,
    });
    await expect(reader.query(api.resources.index.get, { resourceId })).rejects.toThrow("access");
    await expect(
      reader.mutation(api.resources.index.create, { workspaceId, projectId, ...details, documentId })
    ).rejects.toThrow("access");
    expect(
      (await reader.query(api.resources.index.list, { workspaceId, paginationOpts: { numItems: 20, cursor: null } }))
        .page
    ).toEqual([]);
  });
  test("authorized project members create, update, list and remove links with actor attribution", async () => {
    const { owner, workspaceId, projectId, userId } = await workspaceJourney();
    const resourceId = await owner.mutation(api.resources.index.create, { workspaceId, projectId, ...details });
    await owner.mutation(api.resources.index.update, {
      resourceId,
      expectedUpdatedAt: (await owner.query(api.resources.index.get, { resourceId })).updatedAt,
      projectId,
      ...details,
      title: "Updated",
    });
    expect(await owner.query(api.resources.index.get, { resourceId })).toMatchObject({
      title: "Updated",
      createdBy: userId,
      updatedBy: userId,
    });
    expect(
      (await owner.query(api.resources.index.list, { workspaceId, paginationOpts: { numItems: 20, cursor: null } }))
        .page
    ).toHaveLength(1);
    await owner.mutation(api.resources.index.remove, { resourceId });
    await expect(owner.query(api.resources.index.get, { resourceId })).rejects.toThrow("not found");
  });
  test.each([
    "javascript:alert(1)",
    "file:///tmp/file",
    "ftp://example.com",
    "https://user:password@example.com",
    "broken",
  ])("rejects unsafe or malformed URL %s", async (url) => {
    const { owner, workspaceId, projectId } = await workspaceJourney();
    await expect(
      owner.mutation(api.resources.index.create, { workspaceId, projectId, ...details, url })
    ).rejects.toThrow();
  });
  test("workspace membership alone cannot read project links or reassign a link to another workspace", async () => {
    const { t, owner, workspaceId, projectId } = await workspaceJourney();
    const userId = await t.run((ctx) => ctx.db.insert("users", { name: "Colleague" }));
    const colleague = await signedIn(t, userId);
    await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "member" });
    const resourceId = await owner.mutation(api.resources.index.create, { workspaceId, projectId, ...details });
    await expect(colleague.query(api.resources.index.get, { resourceId })).rejects.toThrow("access");
    expect(
      (await colleague.query(api.resources.index.list, { workspaceId, paginationOpts: { numItems: 20, cursor: null } }))
        .page
    ).toEqual([]);
    const otherWorkspace = await owner.mutation(api.workspaces.index.create, { name: "Other", slug: "other" });
    const otherProject = await owner.mutation(api.projects.index.create, {
      workspaceId: otherWorkspace,
      name: "Other",
      identifier: "OTH",
    });
    await expect(
      owner.mutation(api.resources.index.update, {
        resourceId,
        expectedUpdatedAt: (await owner.query(api.resources.index.get, { resourceId })).updatedAt,
        projectId: otherProject,
        ...details,
      })
    ).rejects.toThrow("another workspace");
  });
  test("canonical detail normalizes deep links, projects write permission, and rejects stale edits", async () => {
    const { t, owner, workspaceId, projectId } = await workspaceJourney();
    const resourceId = await owner.mutation(api.resources.index.create, {
      workspaceId,
      projectId,
      ...details,
      title: "  Design  ",
    });
    const baseline = await owner.query(api.resources.index.detail, { workspaceId, resourceId });
    expect(baseline).toMatchObject({ canWrite: true, resource: { title: "Design" } });
    await expect(owner.query(api.resources.index.detail, { workspaceId, resourceId: "invalid" })).rejects.toThrow(
      "not found"
    );
    await owner.mutation(api.resources.index.update, {
      resourceId,
      expectedUpdatedAt: baseline.resource.updatedAt,
      projectId,
      ...details,
      title: "Remote edit",
    });
    await expect(
      owner.mutation(api.resources.index.update, {
        resourceId,
        expectedUpdatedAt: baseline.resource.updatedAt,
        projectId,
        ...details,
        title: "Stale draft",
      })
    ).rejects.toThrow("changed");
    const guestId = await t.run((ctx) => ctx.db.insert("users", { name: "Guest" }));
    await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId: guestId, role: "member" });
    await owner.mutation(api.projects.index.grantMember, { projectId, userId: guestId, role: "guest" });
    const guest = await signedIn(t, guestId);
    expect((await guest.query(api.resources.index.detail, { workspaceId, resourceId })).canWrite).toBe(false);
    await owner.mutation(api.projects.index.revokeMember, { projectId, userId: guestId });
    await expect(guest.query(api.resources.index.detail, { workspaceId, resourceId })).rejects.toThrow("access");
    await expect(
      owner.mutation(api.resources.index.create, { workspaceId, projectId, ...details, description: "x".repeat(10001) })
    ).rejects.toThrow("details");
  });
});
