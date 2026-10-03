import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { ownProfile } from "./profile_owner";
import {
  personalImageDescriptor,
  personalImageSlots,
  requireAppearanceWrite,
  replacePersonalImage,
  userAppearance,
} from "./avatar_owner";
import { requirePersonalImageScope } from "./avatar_access";
import { prepareAsset } from "../assets/index";
import { assetSizeLimit, externalCoverUrl, supportedAssetTypes } from "../assets/content";
import { descriptor } from "../assets/access";
import { pageBudget } from "../commercial/validation";
import { fileMetadataFields, personalImageSlot } from "../assets/schema";
export const get = query({
  args: {},
  handler: async (ctx) => {
    const { user, profile } = await ownProfile(ctx);
    const appearance = await userAppearance(ctx, user._id);
    return {
      avatar: await personalImageDescriptor(ctx, appearance, "avatar"),
      cover: await personalImageDescriptor(ctx, appearance, "cover"),
      externalCoverUrl: appearance?.externalCoverUrl ?? null,
      revision: profile?.revision ?? 0,
      supportedTypes: [...supportedAssetTypes].filter((type) => type.startsWith("image/")),
      maxBytes: assetSizeLimit("image/png"),
    };
  },
});
export const member = query({
  args: { workspaceId: v.id("workspaces"), userId: v.id("users") },
  handler: async (ctx, args) => {
    await requirePersonalImageScope(
      ctx,
      { workspaceId: null, projectId: null, documentId: null, avatarUserId: args.userId },
      false,
      args.workspaceId
    );
    return personalImageDescriptor(ctx, await userAppearance(ctx, args.userId), "avatar", args.workspaceId);
  },
});
export const prepare = mutation({
  args: {
    slot: personalImageSlot,
    expectedRevision: v.number(),
    ...fileMetadataFields,
  },
  handler: async (ctx, { expectedRevision, slot, ...file }) => {
    const { owner } = await requireAppearanceWrite(ctx, expectedRevision);
    if (!file.contentType.startsWith("image/")) throw new ConvexError("Choose a supported profile image.");
    return prepareAsset(
      ctx,
      { ...file, workspaceId: null, projectId: null, documentId: null },
      { purpose: personalImageSlots[slot].purpose, avatarUserId: owner.user._id, avatarRevision: expectedRevision }
    );
  },
});
export const remove = mutation({
  args: { slot: personalImageSlot, assetId: v.id("assets"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const access = await requireAppearanceWrite(ctx, args.expectedRevision);
    const appearance = await userAppearance(ctx, access.owner.user._id);
    if (appearance?.[personalImageSlots[args.slot].field] !== args.assetId)
      throw new ConvexError("Your profile image changed.");
    return replacePersonalImage(ctx, access, args.slot, null);
  },
});
export const removed = query({
  args: { slot: personalImageSlot, paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user } = await ownProfile(ctx);
    const page = await ctx.db
      .query("assets")
      .withIndex("by_personal_user_purpose_status", (q) =>
        q.eq("avatarUserId", user._id).eq("purpose", personalImageSlots[args.slot].purpose).eq("status", "deleted")
      )
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    return {
      ...page,
      page: page.page.map((asset) => Object.assign(descriptor(asset), { recoverUntil: asset.expiresAt })),
    };
  },
});
export const restore = mutation({
  args: { slot: personalImageSlot, assetId: v.id("assets"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const access = await requireAppearanceWrite(ctx, args.expectedRevision);
    const asset = await ctx.db.get(args.assetId);
    if (
      !asset ||
      asset.avatarUserId !== access.owner.user._id ||
      asset.purpose !== personalImageSlots[args.slot].purpose ||
      asset.status !== "deleted"
    )
      throw new ConvexError("Removed profile image not found.");
    if (asset.expiresAt <= Date.now() || !asset.storageId || !(await ctx.db.system.get(asset.storageId)))
      throw new ConvexError("This profile image can no longer be recovered.");
    await ctx.db.patch(asset._id, { status: "ready" });
    return replacePersonalImage(ctx, access, args.slot, asset._id);
  },
});

export const setCoverExternal = mutation({
  args: { expectedRevision: v.number(), url: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const access = await requireAppearanceWrite(ctx, args.expectedRevision);
    return replacePersonalImage(ctx, access, "cover", null, externalCoverUrl(args.url));
  },
});
