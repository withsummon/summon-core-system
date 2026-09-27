import { requireUsableLabel } from "../label_access";
import { validateEstimatePoint } from "../../estimates/access";
import { liveDraftAssets } from "../../assets/draft_access";
import { ConvexError, v } from "convex/values";
import { action, internalQuery, internalMutation } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { requireDraft, draftRevision } from "./access";
import { attachmentRevision } from "../../assets/task_access";
import type { QueryCtx } from "../../_generated/server";
async function source(ctx: QueryCtx, draftId: Id<"taskDrafts">, expectedUpdatedAt: number) {
  const { draft } = await requireDraft(ctx, draftId);
  draftRevision(draft.updatedAt, expectedUpdatedAt);
  if (draft.deletedAt !== null || draft.publishedTaskId) throw new ConvexError("Only an active draft can be copied.");
  if (draft.projectId) await validateEstimatePoint(ctx, draft.projectId, draft.properties.estimatePointId);
  const assets = await liveDraftAssets(ctx, draftId);
  if (assets.length > 100) throw new ConvexError("Draft attachment limit exceeded.");
  if (assets.some((asset) => asset.status === "pending" && asset.expiresAt > Date.now()))
    throw new ConvexError("Finish or cancel pending uploads before copying.");
  const ready = assets.filter((asset) => asset.status === "ready");
  if (ready.reduce((sum, asset) => sum + asset.size, 0) > 32 * 1024 * 1024)
    throw new ConvexError("Copy supports at most 32 MiB of ready attachments.");
  return { draft, assets: ready };
}
export const snapshot = internalQuery({
  args: { draftId: v.id("taskDrafts"), expectedUpdatedAt: v.number() },
  handler: sourceHandler,
});
async function sourceHandler(ctx: QueryCtx, args: { draftId: Id<"taskDrafts">; expectedUpdatedAt: number }) {
  return source(ctx, args.draftId, args.expectedUpdatedAt);
}
export const commit = internalMutation({
  args: {
    draftId: v.id("taskDrafts"),
    expectedUpdatedAt: v.number(),
    files: v.array(v.object({ sourceId: v.id("assets"), revision: v.number(), storageId: v.id("_storage") })),
  },
  handler: async (ctx, args) => {
    const { draft, assets } = await source(ctx, args.draftId, args.expectedUpdatedAt);
    if (args.files.length !== assets.length || new Set(args.files.map((file) => file.sourceId)).size !== assets.length)
      throw new ConvexError("Draft attachments changed during copy.");
    await Promise.all(
      assets.map(async (asset) => {
        const file = args.files.find((item) => item.sourceId === asset._id);
        if (!file || attachmentRevision(asset) !== file.revision || asset.createdBy !== draft.authorId)
          throw new ConvexError("Draft attachments changed during copy.");
        const blob = await ctx.db.system.get(file.storageId);
        const claimed = await ctx.db
          .query("assets")
          .withIndex("by_storage", (q) => q.eq("storageId", file.storageId))
          .unique();
        if (!blob || claimed || blob.size !== asset.size || blob.sha256 !== asset.sha256)
          throw new ConvexError("Copied bytes do not match the source.");
      })
    );
    await Promise.all(draft.properties.labelIds.map((id) => requireUsableLabel(ctx, id)));
    const { _id, _creationTime, ...fields } = draft;
    const draftId = await ctx.db.insert("taskDrafts", { ...fields, updatedAt: Date.now() });
    await Promise.all(
      assets.map(async (asset) => {
        const file = args.files.find((item) => item.sourceId === asset._id);
        if (!file) throw new Error("Validated copied file missing.");
        const { _id: assetId, _creationTime: assetCreatedAt, ...assetFields } = asset;
        await ctx.db.insert("assets", { ...assetFields, draftId, storageId: file.storageId, attachmentRevision: 0 });
      })
    );
    return draftId;
  },
});
export const run = action({
  args: { draftId: v.id("taskDrafts"), expectedUpdatedAt: v.number() },
  handler: async (ctx, args): Promise<Id<"taskDrafts">> => {
    const sourceSnapshot = await ctx.runQuery(internal.tasks.drafts.copy.snapshot, args);
    const files: { sourceId: Id<"assets">; revision: number; storageId: Id<"_storage"> }[] = [];
    // One blob at a time bounds action memory; failed copies remain unclaimed for the existing orphan sweep.
    for (const asset of sourceSnapshot.assets) {
      if (!asset.storageId) throw new ConvexError("Source attachment bytes are missing.");
      // eslint-disable-next-line no-await-in-loop
      const blob = await ctx.storage.get(asset.storageId);
      if (!blob) throw new ConvexError("Source attachment bytes are missing.");
      // eslint-disable-next-line no-await-in-loop
      const storageId = await ctx.storage.store(blob);
      files.push({ sourceId: asset._id, revision: attachmentRevision(asset), storageId });
    }
    return ctx.runMutation(internal.tasks.drafts.copy.commit, { ...args, files });
  },
});
