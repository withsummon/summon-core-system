import { ConvexError, v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { requireMeeting } from "../meetings/access";
import { requireUser } from "../identity/access";
import { prepareAsset } from "./index";
import { fileMetadataFields } from "./schema";
import { meetingRecordingMaxBytes, meetingRecordingTypes } from "./content";
import { descriptor } from "./access";

export const get = query({
  args: { workspaceId: v.id("workspaces"), meetingId: v.id("meetings"), assetId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { meeting } = await requireMeeting(ctx, args.workspaceId, args.meetingId);
    if (!meeting.recordingAssetId || (args.assetId !== undefined && args.assetId !== meeting.recordingAssetId))
      return null;
    return descriptor(await requireReadyRecording(ctx, meeting, meeting.recordingAssetId));
  },
});

export const prepare = mutation({
  args: { workspaceId: v.id("workspaces"), meetingId: v.id("meetings"), ...fileMetadataFields },
  handler: async (ctx, { workspaceId, meetingId, ...file }) => {
    const { meeting } = await requireMeeting(ctx, workspaceId, meetingId, true);
    return prepareAsset(ctx, {
      ...file,
      workspaceId,
      meetingId,
      projectId: meeting.projectId,
      documentId: null,
    });
  },
});

export const policy = query({
  args: { workspaceId: v.id("workspaces"), meetingId: v.id("meetings") },
  handler: async (ctx, { workspaceId, meetingId }) => {
    await requireMeeting(ctx, workspaceId, meetingId, true);
    return { supportedTypes: [...meetingRecordingTypes], maxBytes: meetingRecordingMaxBytes };
  },
});

// Called after the meeting owner authorizes the current actor, including durable jobs.
export async function requireReadyRecording(ctx: QueryCtx, meeting: Doc<"meetings">, assetId: Id<"assets">) {
  const asset = await ctx.db.get(assetId);
  if (
    !asset ||
    asset.status !== "ready" ||
    !asset.storageId ||
    asset.meetingId !== meeting._id ||
    asset.workspaceId !== meeting.workspaceId ||
    asset.projectId !== meeting.projectId
  )
    throw new ConvexError("The meeting recording is unavailable.");
  if (!(await ctx.db.system.get(asset.storageId))) throw new ConvexError("The recording bytes are unavailable.");
  return { ...asset, storageId: asset.storageId };
}

export const discard = mutation({
  args: { assetId: v.id("assets") },
  handler: async (ctx, { assetId }) => {
    const user = await requireUser(ctx);
    const asset = await ctx.db.get(assetId);
    if (!asset || asset.createdBy !== user._id || !asset.meetingId || !asset.workspaceId)
      throw new ConvexError("Recording upload not found.");
    const { meeting } = await requireMeeting(ctx, asset.workspaceId, asset.meetingId, true);
    // A lost start response can already have attached the upload; this cleanup must not remove it.
    if (meeting.recordingAssetId === assetId) return false;
    if (asset.storageId) await ctx.storage.delete(asset.storageId);
    await ctx.db.patch(assetId, { status: "deleted", storageId: null, expiresAt: Date.now() });
    return true;
  },
});
