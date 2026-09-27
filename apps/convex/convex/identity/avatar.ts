import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { ownProfile } from "./profile_owner";
import { avatarDescriptor, requireAvatarWrite, replaceAvatar, userAppearance } from "./avatar_owner";
import { requireAvatarScope } from "./avatar_access";
import { prepareAsset } from "../assets/index";
import { supportedAssetTypes } from "../assets/content";
import { descriptor } from "../assets/access";
import { pageBudget } from "../commercial/validation";
export const get = query({
  args: {},
  handler: async (ctx) => {
    const { user, profile } = await ownProfile(ctx);
    return {
      avatar: await avatarDescriptor(ctx, user._id),
      revision: profile?.revision ?? 0,
      supportedTypes: [...supportedAssetTypes].filter((type) => type.startsWith("image/")),
    };
  },
});
export const member = query({
  args: { workspaceId: v.id("workspaces"), userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAvatarScope(
      ctx,
      { workspaceId: null, projectId: null, documentId: null, avatarUserId: args.userId },
      false,
      args.workspaceId
    );
    const avatar = await avatarDescriptor(ctx, args.userId);
    return avatar ? { ...avatar, downloadPath: `${avatar.downloadPath}?workspace=${args.workspaceId}` } : null;
  },
});
export const prepare = mutation({
  args: {
    expectedRevision: v.number(),
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
    sha256: v.string(),
  },
  handler: async (ctx, { expectedRevision, ...file }) => {
    const { owner } = await requireAvatarWrite(ctx, expectedRevision);
    if (!file.contentType.startsWith("image/")) throw new ConvexError("Choose a supported image for your avatar.");
    return prepareAsset(
      ctx,
      { ...file, workspaceId: null, projectId: null, documentId: null },
      { purpose: "userAvatar", avatarUserId: owner.user._id, avatarRevision: expectedRevision }
    );
  },
});
export const remove = mutation({
  args: { assetId: v.id("assets"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const access = await requireAvatarWrite(ctx, args.expectedRevision);
    const appearance = await userAppearance(ctx, access.owner.user._id);
    if (appearance?.avatarAssetId !== args.assetId) throw new ConvexError("Your avatar changed.");
    await replaceAvatar(ctx, access, null);
  },
});
export const removed = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user } = await ownProfile(ctx);
    const page = await ctx.db
      .query("assets")
      .withIndex("by_avatar_user_status", (q) => q.eq("avatarUserId", user._id).eq("status", "deleted"))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    return {
      ...page,
      page: page.page.map((asset) => Object.assign(descriptor(asset), { recoverUntil: asset.expiresAt })),
    };
  },
});
export const restore = mutation({
  args: { assetId: v.id("assets"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const access = await requireAvatarWrite(ctx, args.expectedRevision);
    const asset = await ctx.db.get(args.assetId);
    if (
      !asset ||
      asset.avatarUserId !== access.owner.user._id ||
      asset.purpose !== "userAvatar" ||
      asset.status !== "deleted"
    )
      throw new ConvexError("Removed avatar not found.");
    if (asset.expiresAt <= Date.now() || !asset.storageId || !(await ctx.db.system.get(asset.storageId)))
      throw new ConvexError("This avatar can no longer be recovered.");
    await replaceAvatar(ctx, access, asset._id);
    await ctx.db.patch(asset._id, { status: "ready" });
  },
});
