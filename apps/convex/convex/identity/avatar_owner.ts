import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { ownProfile, profileRevision, writeProfile } from "./profile_owner";
import { descriptor } from "../assets/access";
export function userAppearance(ctx: QueryCtx, userId: Id<"users">) {
  return ctx.db
    .query("userAppearance")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}
export async function requireAvatarWrite(ctx: QueryCtx, expectedRevision: number) {
  const owner = await ownProfile(ctx);
  const revision = profileRevision(owner.profile, expectedRevision);
  return { owner, revision };
}
export async function replaceAvatar(
  ctx: MutationCtx,
  access: Awaited<ReturnType<typeof requireAvatarWrite>>,
  assetId: Id<"assets"> | null
) {
  const { owner, revision } = access;
  const appearance = await userAppearance(ctx, owner.user._id);
  if (appearance?.avatarAssetId && appearance.avatarAssetId !== assetId) {
    const previous = await ctx.db.get(appearance.avatarAssetId);
    if (!previous || previous.purpose !== "userAvatar" || previous.avatarUserId !== owner.user._id)
      throw new ConvexError("Avatar reference is inconsistent.");
    await ctx.db.patch(previous._id, { status: "deleted", expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  }
  if (appearance) await ctx.db.patch(appearance._id, { avatarAssetId: assetId });
  else await ctx.db.insert("userAppearance", { userId: owner.user._id, avatarAssetId: assetId });
  await writeProfile(ctx, owner, { revision });
}
export async function publishAvatar(ctx: MutationCtx, asset: Doc<"assets">) {
  if (asset.avatarRevision === undefined) throw new ConvexError("Avatar intent is missing.");
  const access = await requireAvatarWrite(ctx, asset.avatarRevision);
  if (asset.avatarUserId !== access.owner.user._id) throw new ConvexError("Avatar owner mismatch.");
  await replaceAvatar(ctx, access, asset._id);
}
export async function avatarDescriptor(ctx: QueryCtx, userId: Id<"users">) {
  const appearance = await userAppearance(ctx, userId);
  const asset = appearance?.avatarAssetId ? await ctx.db.get(appearance.avatarAssetId) : null;
  if (asset && (asset.purpose !== "userAvatar" || asset.avatarUserId !== userId || asset.status !== "ready"))
    throw new ConvexError("Avatar reference is inconsistent.");
  return asset ? descriptor(asset) : null;
}
