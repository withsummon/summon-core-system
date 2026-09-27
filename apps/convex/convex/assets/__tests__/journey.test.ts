import { signedIn } from "../../../test-support/session";
import { createHash } from "node:crypto";
import { describe, expect, it, vi, afterEach } from "vitest";
import { workspaceJourney } from "../../../test-support/fixtures";
import { api, internal } from "../../_generated/api";

async function uploadJourney(content = "Quarterly notes", contentType = "text/plain") {
  const fixture = await workspaceJourney();
  const { owner, t, workspaceId, projectId } = fixture;
  const blob = new Blob([content], { type: contentType });
  const intent = {
    workspaceId,
    projectId,
    documentId: null,
    name: "notes.txt",
    contentType,
    size: blob.size,
    sha256: createHash("sha256").update(content).digest("base64"),
  };
  const { assetId } = await owner.mutation(api.assets.index.prepare, intent);
  const storageId = await t.run((ctx) => ctx.storage.store(blob));
  return { ...fixture, intent, assetId, storageId };
}
afterEach(() => vi.useRealTimers());
describe("Authorized asset lifecycle", () => {
  it("keeps pending files private, validates completion, serves authenticated bytes, then withholds deleted files", async () => {
    const { t, owner, assetId, storageId } = await uploadJourney();
    await expect(owner.query(api.assets.index.get, { assetId })).rejects.toThrow();
    await owner.action(api.assets.upload.finalize, { assetId, storageId });
    await expect(owner.action(api.assets.upload.finalize, { assetId, storageId })).resolves.toBe(assetId);
    const descriptor = await owner.query(api.assets.index.get, { assetId });
    expect(descriptor).not.toHaveProperty("storageId");
    const response = await owner.fetch(`/assets/${assetId}`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Quarterly notes");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await t.fetch(`/assets/${assetId}`)).status).toBe(401);
    await owner.mutation(api.assets.index.remove, { assetId });
    expect(await t.run((ctx) => ctx.db.system.get(storageId))).not.toBeNull();
    await expect(owner.query(api.assets.index.get, { assetId })).rejects.toThrow();
  });
  it("rejects a different uploader and outsiders at every public boundary", async () => {
    const { t, owner, assetId, storageId, intent } = await uploadJourney();
    const strangerId = await t.run((ctx) => ctx.db.insert("users", { name: "Stranger" }));
    const stranger = await signedIn(t, strangerId);
    await expect(stranger.mutation(api.assets.index.prepare, intent)).rejects.toThrow();
    await expect(stranger.action(api.assets.upload.finalize, { assetId, storageId })).rejects.toThrow();
    await owner.action(api.assets.upload.finalize, { assetId, storageId });
    await expect(stranger.query(api.assets.index.get, { assetId })).rejects.toThrow();
    await expect(stranger.mutation(api.assets.index.remove, { assetId })).rejects.toThrow();
    expect((await stranger.fetch(`/assets/${assetId}`)).status).toBe(403);
  });
  it.each(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"])(
    "rejects spoofed %s and removes only its claimed blob",
    async (type) => {
      const { t, owner, assetId, storageId } = await uploadJourney("not an image or PDF", type);
      await expect(owner.action(api.assets.upload.finalize, { assetId, storageId })).rejects.toThrow("declared type");
      expect(await t.run((ctx) => ctx.db.system.get(storageId))).toBeNull();
      expect(await t.run((ctx) => ctx.db.get(assetId))).toMatchObject({ status: "rejected", storageId: null });
    }
  );
  it("rejects substituted bytes without deleting an unclaimed blob", async () => {
    const { t, owner, assetId } = await uploadJourney();
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["different bytes"], { type: "text/plain" })));
    await expect(owner.action(api.assets.upload.finalize, { assetId, storageId })).rejects.toThrow("does not match");
    expect(await t.run((ctx) => ctx.db.system.get(storageId))).not.toBeNull();
  });
  it("rechecks write access before finalization", async () => {
    const { t, owner, userId, workspaceId, assetId, storageId } = await uploadJourney();
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", userId))
        .unique();
      await ctx.db.delete(membership!._id);
    });
    await expect(owner.action(api.assets.upload.finalize, { assetId, storageId })).rejects.toThrow();
    expect(await t.run((ctx) => ctx.db.get(assetId))).toMatchObject({ status: "pending" });
  });
  it("expires pending tickets and sweeps orphan blobs while preserving ready assets", async () => {
    vi.useFakeTimers();
    const { t, owner, assetId, storageId, intent } = await uploadJourney();
    await owner.action(api.assets.upload.finalize, { assetId, storageId });
    const pending = await owner.mutation(api.assets.index.prepare, intent);
    const orphan = await t.run((ctx) => ctx.storage.store(new Blob(["orphan"])));
    vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);
    await t.mutation(internal.assets.cleanup.expire, {});
    await t.mutation(internal.assets.cleanup.sweep, { cursor: null });
    expect(await t.run((ctx) => ctx.db.get(pending.assetId))).toMatchObject({ status: "expired" });
    expect(await t.run((ctx) => ctx.db.system.get(orphan))).toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get(storageId))).not.toBeNull();
  });
  it("enforces document lock and project ownership on upload scope", async () => {
    const { t, owner, workspaceId, projectId, intent } = await uploadJourney();
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
    const ticket = await owner.mutation(api.assets.index.prepare, { ...intent, documentId });
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["Quarterly notes"], { type: "text/plain" })));
    await owner.action(api.assets.upload.finalize, { assetId: ticket.assetId, storageId });
    const copy = await owner.action(api.assets.upload.duplicate, { documentId, assetId: ticket.assetId });
    const copyRecord = await t.run((ctx) => ctx.db.get(copy));
    expect(copyRecord?.storageId).not.toBe(storageId);
    await owner.mutation(api.assets.index.remove, { assetId: ticket.assetId });
    expect(
      await owner.query(api.assets.index.resolveDocumentAsset, { documentId, assetId: ticket.assetId })
    ).toBeNull();
    await expect(owner.query(api.assets.index.get, { assetId: copy })).resolves.toMatchObject({ id: copy });
    await owner.mutation(api.assets.index.restore, { documentId, assetId: ticket.assetId });
    expect(
      await owner.query(api.assets.index.resolveDocumentAsset, { documentId, assetId: ticket.assetId })
    ).toMatchObject({ id: ticket.assetId });
    await owner.mutation(api.assets.index.remove, { assetId: ticket.assetId });
    await owner.mutation(api.documents.index.setLifecycle, {
      expectedUpdatedAt: (await owner.query(api.documents.index.get, { documentId })).updatedAt,
      documentId,
      isLocked: true,
      archived: false,
      deleted: false,
    });
    await expect(owner.mutation(api.assets.index.prepare, { ...intent, documentId })).rejects.toThrow("read-only");
    await expect(owner.mutation(api.assets.index.restore, { documentId, assetId: ticket.assetId })).rejects.toThrow(
      "read-only"
    );
    await expect(owner.action(api.assets.upload.duplicate, { documentId, assetId: copy })).rejects.toThrow("read-only");
    await owner.mutation(api.documents.index.setLifecycle, {
      expectedUpdatedAt: (await owner.query(api.documents.index.get, { documentId })).updatedAt,
      documentId,
      isLocked: false,
      archived: false,
      deleted: false,
    });
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 8 * 24 * 60 * 60 * 1000);
    await expect(owner.mutation(api.assets.index.restore, { documentId, assetId: ticket.assetId })).rejects.toThrow(
      "expired"
    );
    await t.mutation(internal.assets.cleanup.sweep, { cursor: null });
    expect(await t.run((ctx) => ctx.db.system.get(storageId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get(copyRecord!.storageId!))).not.toBeNull();
    const otherWorkspace = await owner.mutation(api.workspaces.index.create, { name: "Other", slug: "other" });
    await expect(owner.mutation(api.assets.index.prepare, { ...intent, workspaceId: otherWorkspace })).rejects.toThrow(
      "another workspace"
    );
  });
  it.each([
    { name: "../x" },
    { contentType: "text/html" },
    { size: 0 },
    { size: 1.1 },
    { size: 11 * 1024 * 1024 },
    { sha256: "invalid" },
  ])("rejects invalid upload intent %j", async (override) => {
    const { owner, intent } = await uploadJourney();
    await expect(owner.mutation(api.assets.index.prepare, { ...intent, ...override })).rejects.toThrow();
  });
});
