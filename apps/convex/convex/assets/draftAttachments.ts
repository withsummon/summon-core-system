import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { pageBudget } from "../commercial/validation";
import { requireDraftAttachmentAccess, draftAttachmentChanged, liveDraftAssets } from "./draft_access";
import { prepareAsset } from "./index";
import { descriptor } from "./access";
import { attachmentRevision } from "./task_access";
import { changeAttachmentState } from "./attachment_lifecycle";
export const access = query({
  args: { draftId: v.id("taskDrafts") },
  handler: async (ctx, args) => {
    const { draft } = await requireDraftAttachmentAccess(ctx, args.draftId);
    return { draftId: draft._id, workspaceId: draft.workspaceId, canUpload: true };
  },
});
export const prepare = mutation({
  args: {
    draftId: v.id("taskDrafts"),
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
    sha256: v.string(),
  },
  handler: async (ctx, { draftId, ...file }) => {
    const { draft } = await requireDraftAttachmentAccess(ctx, draftId);
    const assets = await liveDraftAssets(ctx, draftId);
    if (assets.length >= 100)
      throw new ConvexError("A draft can have at most 100 active uploads and recoverable files.");
    return prepareAsset(ctx, { ...file, draftId, workspaceId: draft.workspaceId, projectId: null, documentId: null });
  },
});
export const list = query({
  args: { draftId: v.id("taskDrafts"), deleted: v.boolean(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireDraftAttachmentAccess(ctx, args.draftId);
    const result = await ctx.db
      .query("assets")
      .withIndex("by_draft", (q) => q.eq("draftId", args.draftId))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    const page = await Promise.all(
      result.page
        .filter((asset) => asset.status === (args.deleted ? "deleted" : "ready"))
        .map(async (asset) =>
          Object.assign(descriptor(asset), {
            revision: attachmentRevision(asset),
            status: asset.status,
            canRemove: asset.status === "ready",
            canRestore:
              asset.status === "deleted" &&
              asset.expiresAt > Date.now() &&
              !!asset.storageId &&
              !!(await ctx.db.system.get(asset.storageId)),
            restoreUntil: asset.status === "deleted" ? asset.expiresAt : null,
          })
        )
    );
    return { ...result, page };
  },
});
export const change = mutation({
  args: { draftId: v.id("taskDrafts"), assetId: v.id("assets"), expectedRevision: v.number(), deleted: v.boolean() },
  handler: async (ctx, args) => {
    await requireDraftAttachmentAccess(ctx, args.draftId);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.draftId !== args.draftId) throw new ConvexError("Draft attachment not found.");
    await changeAttachmentState(ctx, asset, args.expectedRevision, args.deleted);
    await draftAttachmentChanged(ctx, args.draftId);
    return asset._id;
  },
});
export async function transferDraftAttachments(ctx: MutationCtx, draft: Doc<"taskDrafts">, taskId: Id<"tasks">) {
  const assets = await liveDraftAssets(ctx, draft._id);
  if (assets.length > 100) throw new ConvexError("Draft attachment limit exceeded.");
  if (assets.some((asset) => asset.status === "pending" && asset.expiresAt > Date.now()))
    throw new ConvexError("Finish or wait for pending uploads to expire before publishing.");
  if (!draft.projectId) throw new ConvexError("Choose a project before publishing.");
  await Promise.all(
    assets
      .filter((asset) => asset.status === "ready" || asset.status === "deleted")
      .map(async (asset) => {
        if (asset.createdBy !== draft.authorId) throw new ConvexError("Draft attachment uploader mismatch.");
        if (asset.status === "ready" && (!asset.storageId || !(await ctx.db.system.get(asset.storageId))))
          throw new ConvexError("Draft attachment bytes are missing.");
        await ctx.db.patch(asset._id, {
          draftId: undefined,
          taskId,
          projectId: draft.projectId,
          attachmentRevision: attachmentRevision(asset) + 1,
        });
      })
  );
}
export const pending = query({
  args: { draftId: v.id("taskDrafts") },
  handler: async (ctx, args) => {
    await requireDraftAttachmentAccess(ctx, args.draftId);
    const rows = await liveDraftAssets(ctx, args.draftId);
    return rows
      .filter((row) => row.status === "pending" && row.expiresAt > Date.now())
      .map((row) => ({ id: row._id, name: row.name, expiresAt: row.expiresAt }));
  },
});
export const cancelUpload = mutation({
  args: { draftId: v.id("taskDrafts"), assetId: v.id("assets") },
  handler: async (ctx, args) => {
    await requireDraftAttachmentAccess(ctx, args.draftId);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.draftId !== args.draftId) throw new ConvexError("Draft upload not found.");
    if (asset.status === "rejected") return;
    if (asset.status !== "pending") throw new ConvexError("Upload is already closed.");
    if (asset.storageId) await ctx.storage.delete(asset.storageId);
    await ctx.db.patch(asset._id, { status: "rejected", storageId: null });
  },
});
