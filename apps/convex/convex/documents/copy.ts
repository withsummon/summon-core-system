import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, query } from "../_generated/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { requireUser, requireWorkspace } from "../identity/access";
import { requireAsset } from "../assets/access";
import { requireDocument, requireMetadataVersion } from "./access";
import { documentCopyParent } from "./hierarchy";
import { saveDocumentSnapshot, validateDocumentMetadata } from "./index";
import { snapshotFields } from "./schema";
const MAX_COPY_FILES = 100;
const MAX_COPY_BYTES = 32 * 1024 * 1024;
const COPY_LIFETIME = 15 * 60 * 1000;
export const copyArgs = {
  documentId: v.id("documents"),
  expectedRevision: v.number(),
  expectedUpdatedAt: v.number(),
  requestId: v.string(),
};
async function source(ctx: QueryCtx, documentId: Id<"documents">, revision: number, updatedAt: number) {
  const { document, user } = await requireDocument(ctx, documentId);
  await requireWorkspace(ctx, document.workspaceId, true);
  requireMetadataVersion(document, updatedAt);
  if (document.revision !== revision) throw new ConvexError("Document content changed. Review it before copying.");
  const name = `${document.name} (Copy)`;
  await validateDocumentMetadata(ctx, document.workspaceId, { ...document, name });
  const parent = await documentCopyParent(ctx, document);
  const snapshot = await ctx.db
    .query("documentRevisions")
    .withIndex("by_document_revision", (q) => q.eq("documentId", documentId).eq("revision", revision))
    .unique();
  if (revision > 0 && !snapshot) throw new ConvexError("Current document snapshot is unavailable.");
  return { document, user, snapshot, name, ...parent };
}
async function ownedJob(ctx: QueryCtx, jobId: Id<"documentCopies">) {
  const user = await requireUser(ctx);
  const job = await ctx.db.get(jobId);
  if (!job || job.actorId !== user._id) throw new ConvexError("Document copy not found.");
  if (job.status === "expired" || (job.status === "pending" && job.expiresAt <= Date.now()))
    throw new ConvexError("Document copy expired. Start a new copy.");
  return job;
}
export const lookup = internalQuery({
  args: copyArgs,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!args.requestId || args.requestId.length > 100) throw new ConvexError("Invalid copy request.");
    const job = await ctx.db
      .query("documentCopies")
      .withIndex("by_actor_request", (q) => q.eq("actorId", user._id).eq("requestId", args.requestId))
      .unique();
    if (job) {
      if (
        job.documentId !== args.documentId ||
        job.expectedRevision !== args.expectedRevision ||
        job.expectedUpdatedAt !== args.expectedUpdatedAt
      )
        throw new ConvexError("Copy request already used for different content.");
      await ownedJob(ctx, job._id);
      await requireDocument(ctx, job.documentId);
      return { job, source: null };
    }
    return { job: null, source: await source(ctx, args.documentId, args.expectedRevision, args.expectedUpdatedAt) };
  },
});
async function sourceAssets(ctx: QueryCtx, document: Doc<"documents">, ids: string[]) {
  if (ids.length > MAX_COPY_FILES || new Set(ids).size !== ids.length)
    throw new ConvexError("Document copy supports at most 100 distinct images.");
  const assets = await Promise.all(
    ids.map(async (id) => {
      const assetId = ctx.db.normalizeId("assets", id);
      if (!assetId) throw new ConvexError("Document contains an unavailable image.");
      const { asset } = await requireAsset(ctx, assetId);
      if (asset.documentId !== document._id || !asset.storageId)
        throw new ConvexError("Document image belongs to another document or has no bytes.");
      return { ...asset, storageId: asset.storageId };
    })
  );
  if (assets.reduce((sum, asset) => sum + asset.size, 0) > MAX_COPY_BYTES)
    throw new ConvexError("Document copy supports at most 32 MiB of images.");
  return assets;
}
export const begin = internalMutation({
  args: { ...copyArgs, assetIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const current = await source(ctx, args.documentId, args.expectedRevision, args.expectedUpdatedAt);
    const previous = await ctx.db
      .query("documentCopies")
      .withIndex("by_actor_request", (q) => q.eq("actorId", current.user._id).eq("requestId", args.requestId))
      .unique();
    if (previous) {
      if (
        previous.documentId !== args.documentId ||
        previous.expectedRevision !== args.expectedRevision ||
        previous.expectedUpdatedAt !== args.expectedUpdatedAt
      )
        throw new ConvexError("Copy request already used for different content.");
      await ownedJob(ctx, previous._id);
      return previous._id;
    }
    const assets = await sourceAssets(ctx, current.document, args.assetIds);
    const jobId = await ctx.db.insert("documentCopies", {
      actorId: current.user._id,
      requestId: args.requestId,
      documentId: args.documentId,
      expectedRevision: args.expectedRevision,
      expectedUpdatedAt: args.expectedUpdatedAt,
      parentId: current.parentId,
      parentUpdatedAt: current.parentUpdatedAt,
      files: [],
      cursor: 0,
      expiresAt: Date.now() + COPY_LIFETIME,
      status: "pending",
      resultId: null,
    });
    const files = await Promise.all(
      assets.map(async (asset) => {
        const targetId = await ctx.db.insert("assets", {
          workspaceId: asset.workspaceId,
          projectId: null,
          documentId: null,
          documentCopyId: jobId,
          name: asset.name,
          contentType: asset.contentType,
          size: asset.size,
          sha256: asset.sha256,
          createdBy: current.user._id,
          storageId: null,
          status: "pending",
          expiresAt: Date.now() + COPY_LIFETIME,
        });
        return {
          sourceId: asset._id,
          targetId,
          sourceStorageId: asset.storageId,
          sha256: asset.sha256,
          size: asset.size,
        };
      })
    );
    await ctx.db.patch(jobId, { files });
    await ctx.scheduler.runAfter(COPY_LIFETIME, internal.documents.copy.expire, { jobId });
    return jobId;
  },
});
export const progress = internalQuery({
  args: { jobId: v.id("documentCopies") },
  handler: async (ctx, { jobId }) => {
    const job = await ownedJob(ctx, jobId);
    const current = await source(ctx, job.documentId, job.expectedRevision, job.expectedUpdatedAt);
    return { job, source: current };
  },
});
export const record = internalMutation({
  args: { jobId: v.id("documentCopies"), index: v.number(), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const job = await ownedJob(ctx, args.jobId);
    if (job.status !== "pending") return;
    if (args.index < job.cursor) return;
    if (args.index !== job.cursor || !job.files[args.index]) throw new ConvexError("Copy progress changed.");
    const file = job.files[args.index];
    const blob = await ctx.db.system.get(args.storageId);
    const claimed = await ctx.db
      .query("assets")
      .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (!blob || claimed || blob.size !== file.size || blob.sha256 !== file.sha256)
      throw new ConvexError("Copied bytes do not match source.");
    await ctx.db.patch(file.targetId, { storageId: args.storageId });
    await ctx.db.patch(job._id, { cursor: job.cursor + 1 });
  },
});
async function validateFiles(ctx: MutationCtx, job: Doc<"documentCopies">, document: Doc<"documents">) {
  if (job.cursor !== job.files.length) throw new ConvexError("Finish copying document images first.");
  const assets = await sourceAssets(
    ctx,
    document,
    job.files.map((file) => file.sourceId)
  );
  await Promise.all(
    job.files.map(async (file, index) => {
      const original = assets[index],
        target = await ctx.db.get(file.targetId);
      const blob = target?.storageId ? await ctx.db.system.get(target.storageId) : null;
      if (
        original.storageId !== file.sourceStorageId ||
        original.sha256 !== file.sha256 ||
        original.size !== file.size ||
        !target ||
        target.documentCopyId !== job._id ||
        target.status !== "pending" ||
        !blob ||
        blob.sha256 !== file.sha256 ||
        blob.size !== file.size
      )
        throw new ConvexError("Document images changed while copying.");
    })
  );
}
export const publish = internalMutation({
  args: { jobId: v.id("documentCopies"), ...snapshotFields },
  handler: async (ctx, args) => {
    const job = await ownedJob(ctx, args.jobId);
    if (job.resultId) return job.resultId;
    const current = await source(ctx, job.documentId, job.expectedRevision, job.expectedUpdatedAt);
    if (current.parentId !== job.parentId || current.parentUpdatedAt !== job.parentUpdatedAt)
      throw new ConvexError("Parent changed while copying.");
    await validateFiles(ctx, job, current.document);
    const { _id, _creationTime, ...metadata } = current.document;
    const documentId = await ctx.db.insert("documents", {
      ...metadata,
      name: current.name,
      ownedBy: current.user._id,
      updatedBy: current.user._id,
      updatedAt: Date.now(),
      revision: 0,
      isLocked: false,
      archived: false,
    });
    await saveDocumentSnapshot(ctx, {
      documentId,
      expectedRevision: 0,
      descriptionBinary: args.descriptionBinary,
      descriptionHtml: args.descriptionHtml,
      descriptionJson: args.descriptionJson,
    });
    if (current.parentId) await ctx.db.insert("documentParents", { documentId, parentId: current.parentId });
    await Promise.all(
      job.files.map((file) =>
        ctx.db.patch(file.targetId, { documentId, documentCopyId: undefined, status: "ready", expiresAt: 0 })
      )
    );
    await ctx.db.patch(documentId, { isLocked: current.document.isLocked, archived: current.document.archived });
    await ctx.db.patch(job._id, { status: "published", resultId: documentId });
    return documentId;
  },
});
export const expire = internalMutation({
  args: { jobId: v.id("documentCopies") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job || job.status !== "pending" || job.expiresAt > Date.now()) return;
    await Promise.all(
      job.files.map(async (file) => {
        const asset = await ctx.db.get(file.targetId);
        if (asset?.documentCopyId !== jobId) return;
        if (asset.storageId && (await ctx.db.system.get(asset.storageId))) await ctx.storage.delete(asset.storageId);
        await ctx.db.patch(asset._id, { status: "expired", storageId: null });
      })
    );
    await ctx.db.patch(jobId, { status: "expired" });
  },
});

export const availability = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const { document } = await requireDocument(ctx, documentId);
    try {
      await source(ctx, documentId, document.revision, document.updatedAt);
      return { canCopy: true, reason: null };
    } catch (error) {
      if (!(error instanceof ConvexError) || typeof error.data !== "string") throw error;
      return { canCopy: false, reason: error.data };
    }
  },
});
