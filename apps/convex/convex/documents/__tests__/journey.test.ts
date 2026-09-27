import { describe, expect, test, vi } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";

const metadata = {
  name: "Delivery notes",
  access: "public" as const,
  isGlobal: false,
  color: "",
  viewProps: {
    full_width: true,
    summon_document: { markdown: "# Notes", citations: [{ source: "meeting" }], discussion_topics: ["Delivery"] },
  },
  logoProps: { emoji: "📄" },
  sortOrder: 65535,
  category: "meeting",
  tags: ["delivery"],
  clientId: null,
  opportunityId: null,
  externalId: "old-page",
  externalSource: "plane",
};
const snapshot = {
  descriptionBinary: new Uint8Array([0, 255, 1, 127]).buffer,
  descriptionHtml: "<p>Notes</p>",
  descriptionJson: { type: "doc", content: [{ type: "paragraph" }] },
};

describe("document metadata and immutable binary revisions", () => {
  test("editor title and content advance atomically; a stale title cannot overwrite the current name", async () => {
    const { owner, workspaceId, projectId } = await workspaceJourney();
    const documentId = await owner.mutation(api.documents.index.create, {
      workspaceId,
      projectIds: [projectId],
      ...metadata,
    });
    await owner.mutation(api.documents.index.saveSnapshot, {
      documentId,
      expectedRevision: 0,
      name: "Edited title",
      ...snapshot,
    });
    await expect(
      owner.mutation(api.documents.index.saveSnapshot, {
        documentId,
        expectedRevision: 0,
        name: "Stale title",
        ...snapshot,
      })
    ).rejects.toThrow("revision conflict");
    expect(await owner.query(api.documents.index.get, { documentId })).toMatchObject({
      name: "Edited title",
      revision: 1,
    });
  });
  test("collaboration context derives identity and read-only status from current document permissions", async () => {
    const { t, owner, workspaceId, projectId, userId } = await workspaceJourney();
    const documentId = await owner.mutation(api.documents.index.create, {
      workspaceId,
      projectIds: [projectId],
      ...metadata,
    });
    expect(await owner.query(api.documents.index.collaborationContext, { documentId })).toMatchObject({
      documentId,
      userId,
      canWrite: true,
    });
    await owner.mutation(api.documents.index.setLifecycle, {
      expectedUpdatedAt: (await owner.query(api.documents.index.get, { documentId })).updatedAt,
      documentId,
      isLocked: true,
      archived: false,
      deleted: false,
    });
    expect(await owner.query(api.documents.index.collaborationContext, { documentId })).toMatchObject({
      canWrite: false,
    });
    await expect(t.query(api.documents.index.collaborationContext, { documentId })).rejects.toThrow("Sign in");
    await expect(owner.query(api.documents.index.collaborationContext, { documentId: workspaceId })).rejects.toThrow(
      "not found"
    );
  });
  test("simultaneous snapshots cannot silently overwrite a committed revision", async () => {
    const { owner, workspaceId, projectId } = await workspaceJourney();
    const documentId = await owner.mutation(api.documents.index.create, {
      workspaceId,
      projectIds: [projectId],
      ...metadata,
    });
    const outcomes = await Promise.allSettled([
      owner.mutation(api.documents.index.saveSnapshot, { documentId, expectedRevision: 0, ...snapshot }),
      owner.mutation(api.documents.index.saveSnapshot, {
        documentId,
        expectedRevision: 0,
        ...snapshot,
        descriptionHtml: "<p>Concurrent</p>",
      }),
    ]);
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await owner.query(api.documents.index.get, { documentId })).toMatchObject({ revision: 1 });
  });
  test("metadata aliases and exact binary bytes survive revision writes; stale saves preserve both histories", async () => {
    const { owner, workspaceId, projectId } = await workspaceJourney();
    const documentId = await owner.mutation(api.documents.index.create, {
      workspaceId,
      projectIds: [projectId],
      ...metadata,
    });
    expect(
      await owner.mutation(api.documents.index.saveSnapshot, { documentId, expectedRevision: 0, ...snapshot })
    ).toBe(1);
    await expect(
      owner.mutation(api.documents.index.saveSnapshot, {
        documentId,
        expectedRevision: 0,
        ...snapshot,
        descriptionHtml: "stale",
      })
    ).rejects.toThrow("revision conflict");
    expect(await owner.query(api.documents.index.snapshot, { documentId })).toMatchObject(snapshot);
    await owner.mutation(api.documents.index.saveSnapshot, {
      documentId,
      expectedRevision: 1,
      ...snapshot,
      descriptionBinary: new Uint8Array([1, 2, 3]).buffer,
    });
    expect(await owner.query(api.documents.index.snapshot, { documentId, revision: 1 })).toMatchObject(snapshot);
    expect(await owner.query(api.documents.index.get, { documentId })).toMatchObject({ ...metadata, revision: 2 });
  });
  test("private documents and their revisions remain owner-only, while project guests may read public documents", async () => {
    const { t, owner, workspaceId, projectId } = await workspaceJourney();
    const userId = await t.run((ctx) => ctx.db.insert("users", { name: "Reader" }));
    const reader = t.withIdentity({ subject: userId });
    await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "member" });
    await owner.mutation(api.projects.index.grantMember, { projectId, userId, role: "guest" });
    const documentId = await owner.mutation(api.documents.index.create, {
      workspaceId,
      projectIds: [projectId],
      ...metadata,
    });
    expect(await reader.query(api.documents.index.get, { documentId })).toMatchObject({ name: metadata.name });
    await expect(
      reader.mutation(api.documents.index.saveSnapshot, { documentId, expectedRevision: 0, ...snapshot })
    ).rejects.toThrow("access");
    await owner.mutation(api.documents.index.update, {
      expectedUpdatedAt: (await owner.query(api.documents.index.get, { documentId })).updatedAt,
      documentId,
      projectIds: [projectId],
      ...metadata,
      access: "private",
    });
    await expect(reader.query(api.documents.index.snapshot, { documentId })).rejects.toThrow("access");
    expect(
      (await reader.query(api.documents.index.list, { workspaceId, paginationOpts: { numItems: 10, cursor: null } }))
        .page
    ).toEqual([]);
  });
  test("locked, archived and deleted documents reject edits, and the owner can unlock before editing", async () => {
    const { owner, workspaceId, projectId } = await workspaceJourney();
    const documentId = await owner.mutation(api.documents.index.create, {
      workspaceId,
      projectIds: [projectId],
      ...metadata,
    });
    await owner.mutation(api.documents.index.setLifecycle, {
      expectedUpdatedAt: (await owner.query(api.documents.index.get, { documentId })).updatedAt,
      documentId,
      isLocked: true,
      archived: false,
      deleted: false,
    });
    await expect(
      owner.mutation(api.documents.index.saveSnapshot, { documentId, expectedRevision: 0, ...snapshot })
    ).rejects.toThrow("locked");
    await owner.mutation(api.documents.index.setLifecycle, {
      expectedUpdatedAt: (await owner.query(api.documents.index.get, { documentId })).updatedAt,
      documentId,
      isLocked: false,
      archived: true,
      deleted: false,
    });
    await expect(
      owner.mutation(api.documents.index.update, {
        expectedUpdatedAt: (await owner.query(api.documents.index.get, { documentId })).updatedAt,
        documentId,
        projectIds: [projectId],
        ...metadata,
      })
    ).rejects.toThrow("archived");
    await owner.mutation(api.documents.index.setLifecycle, {
      expectedUpdatedAt: (await owner.query(api.documents.index.get, { documentId })).updatedAt,
      documentId,
      isLocked: false,
      archived: false,
      deleted: false,
    });
    await owner.mutation(api.documents.index.saveSnapshot, { documentId, expectedRevision: 0, ...snapshot });
    await owner.mutation(api.documents.index.setLifecycle, {
      expectedUpdatedAt: (await owner.query(api.documents.index.get, { documentId })).updatedAt,
      documentId,
      isLocked: false,
      archived: false,
      deleted: true,
    });
    await expect(owner.query(api.documents.index.get, { documentId })).rejects.toThrow("not found");
  });
  test("cross-workspace project links and oversized snapshots are rejected before writes", async () => {
    const { owner, workspaceId, projectId } = await workspaceJourney();
    const otherWorkspace = await owner.mutation(api.workspaces.index.create, { name: "Other", slug: "other" });
    await expect(
      owner.mutation(api.documents.index.create, { workspaceId: otherWorkspace, projectIds: [projectId], ...metadata })
    ).rejects.toThrow("another workspace");
    const documentId = await owner.mutation(api.documents.index.create, {
      workspaceId,
      projectIds: [projectId],
      ...metadata,
    });
    await expect(
      owner.mutation(api.documents.index.saveSnapshot, {
        documentId,
        expectedRevision: 0,
        ...snapshot,
        descriptionBinary: new ArrayBuffer(524289),
      })
    ).rejects.toThrow("size");
    expect(await owner.query(api.documents.index.get, { documentId })).toMatchObject({ revision: 0 });
    expect(await owner.query(api.documents.index.snapshot, { documentId })).toBeNull();
  });
});

describe("document settings preserve concurrent changes", () => {
  test("a stale metadata form cannot overwrite newer visibility or editor title", async () => {
    const { owner, workspaceId, projectId } = await workspaceJourney();
    const documentId = await owner.mutation(api.documents.index.create, {
      workspaceId,
      projectIds: [projectId],
      ...metadata,
    });
    const opening = await owner.query(api.documents.index.get, { documentId });
    await owner.mutation(api.documents.index.update, {
      documentId,
      expectedUpdatedAt: opening.updatedAt,
      projectIds: [projectId],
      ...metadata,
      access: "private",
    });
    await expect(
      owner.mutation(api.documents.index.update, {
        documentId,
        expectedUpdatedAt: opening.updatedAt,
        projectIds: [projectId],
        ...metadata,
        category: "stale draft",
      })
    ).rejects.toThrow("changed while you were editing");
    const afterVisibility = await owner.query(api.documents.index.get, { documentId });
    await owner.mutation(api.documents.index.saveSnapshot, {
      documentId,
      expectedRevision: 0,
      name: "Live editor title",
      ...snapshot,
    });
    await expect(
      owner.mutation(api.documents.index.update, {
        documentId,
        expectedUpdatedAt: afterVisibility.updatedAt,
        projectIds: [projectId],
        ...metadata,
        access: "private",
      })
    ).rejects.toThrow("changed while you were editing");
    expect(await owner.query(api.documents.index.get, { documentId })).toMatchObject({
      access: "private",
      name: "Live editor title",
      category: metadata.category,
      revision: 1,
    });
  });
  test("a stale lifecycle action cannot undo a newer lock or archive", async () => {
    const { owner, workspaceId, projectId } = await workspaceJourney();
    const documentId = await owner.mutation(api.documents.index.create, {
      workspaceId,
      projectIds: [projectId],
      ...metadata,
    });
    const opening = await owner.query(api.documents.index.get, { documentId });
    await owner.mutation(api.documents.index.setLifecycle, {
      documentId,
      expectedUpdatedAt: opening.updatedAt,
      isLocked: true,
      archived: false,
      deleted: false,
    });
    await expect(
      owner.mutation(api.documents.index.setLifecycle, {
        documentId,
        expectedUpdatedAt: opening.updatedAt,
        isLocked: false,
        archived: true,
        deleted: false,
      })
    ).rejects.toThrow("changed while you were editing");
    const locked = await owner.query(api.documents.index.get, { documentId });
    await owner.mutation(api.documents.index.setLifecycle, {
      documentId,
      expectedUpdatedAt: locked.updatedAt,
      isLocked: true,
      archived: true,
      deleted: false,
    });
    await expect(
      owner.mutation(api.documents.index.setLifecycle, {
        documentId,
        expectedUpdatedAt: locked.updatedAt,
        isLocked: false,
        archived: false,
        deleted: true,
      })
    ).rejects.toThrow("changed while you were editing");
    expect(await owner.query(api.documents.index.get, { documentId })).toMatchObject({
      isLocked: true,
      archived: true,
      deleted: false,
    });
  });
  test("every document writer advances the settings version even within one millisecond", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
    try {
      const { owner, workspaceId, projectId } = await workspaceJourney();
      const documentId = await owner.mutation(api.documents.index.create, {
        workspaceId,
        projectIds: [projectId],
        ...metadata,
      });
      const opening = await owner.query(api.documents.index.get, { documentId });
      await owner.mutation(api.documents.index.update, {
        documentId,
        expectedUpdatedAt: opening.updatedAt,
        projectIds: [projectId],
        ...metadata,
        category: "updated",
      });
      const updated = await owner.query(api.documents.index.get, { documentId });
      expect(updated.updatedAt).toBe(opening.updatedAt + 1);
      await owner.mutation(api.documents.index.saveSnapshot, { documentId, expectedRevision: 0, ...snapshot });
      const saved = await owner.query(api.documents.index.get, { documentId });
      expect(saved.updatedAt).toBe(updated.updatedAt + 1);
      await owner.mutation(api.documents.index.setLifecycle, {
        documentId,
        expectedUpdatedAt: saved.updatedAt,
        isLocked: true,
        archived: false,
        deleted: false,
      });
      expect((await owner.query(api.documents.index.get, { documentId })).updatedAt).toBe(saved.updatedAt + 1);
      await expect(
        owner.mutation(api.documents.index.update, {
          documentId,
          expectedUpdatedAt: opening.updatedAt,
          projectIds: [projectId],
          ...metadata,
        })
      ).rejects.toThrow("changed while you were editing");
    } finally {
      clock.mockRestore();
    }
  });
});
