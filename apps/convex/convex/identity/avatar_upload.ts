import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, internalQuery } from "../_generated/server";
import { requireUser } from "./access";

/** Only the publisher can acknowledge the profile revision produced by this upload. */
export const receipt = internalQuery({
  args: { assetId: v.id("assets") },
  handler: async (ctx, { assetId }) => {
    const user = await requireUser(ctx);
    const asset = await ctx.db.get(assetId);
    if (
      !asset ||
      (asset.purpose !== "userAvatar" && asset.purpose !== "userCover") ||
      asset.avatarUserId !== user._id ||
      asset.avatarRevision === undefined
    )
      throw new ConvexError("Profile image upload not found.");
    return {
      assetId: asset._id,
      startingRevision: asset.avatarRevision,
      profileRevision: asset.avatarPublishedRevision ?? null,
    };
  },
});

export const finalize = action({
  args: { assetId: v.id("assets"), storageId: v.string() },
  handler: async (ctx, args): Promise<{ assetId: Id<"assets">; startingRevision: number; profileRevision: number }> => {
    await ctx.runQuery(internal.identity.avatar_upload.receipt, { assetId: args.assetId });
    await ctx.runAction(api.assets.upload.finalize, args);
    const result = await ctx.runQuery(internal.identity.avatar_upload.receipt, { assetId: args.assetId });
    if (result.profileRevision === null) throw new ConvexError("This upload has no profile acknowledgement.");
    return { ...result, profileRevision: result.profileRevision };
  },
});
