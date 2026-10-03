import { ConvexError } from "convex/values";
import type { Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { personalImagePurpose, personalImageSlot } from "../assets/schema";
import { ownProfile, profileRevision, writeProfile } from "./profile_owner";
import { descriptor } from "../assets/access";

export const personalImageSlots = {
  avatar: { field: "avatarAssetId", purpose: "userAvatar" },
  cover: { field: "coverAssetId", purpose: "userCover" },
} as const satisfies Record<
  Infer<typeof personalImageSlot>,
  { field: "avatarAssetId" | "coverAssetId"; purpose: Infer<typeof personalImagePurpose> }
>;

export function userAppearance(ctx: QueryCtx, userId: Id<"users">) {
  return ctx.db
    .query("userAppearance")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}
export async function requireAppearanceWrite(ctx: QueryCtx, expectedRevision: number) {
  const owner = await ownProfile(ctx);
  const revision = profileRevision(owner.profile, expectedRevision);
  return { owner, revision };
}
export async function replacePersonalImage(
  ctx: MutationCtx,
  access: Awaited<ReturnType<typeof requireAppearanceWrite>>,
  slot: Infer<typeof personalImageSlot>,
  assetId: Id<"assets"> | null,
  externalCoverUrl?: string
) {
  const { owner, revision } = access;
  const appearance = await userAppearance(ctx, owner.user._id);
  const current = appearance?.[personalImageSlots[slot].field];
  if (current && current !== assetId) {
    const previous = await ctx.db.get(current);
    if (!previous || previous.purpose !== personalImageSlots[slot].purpose || previous.avatarUserId !== owner.user._id)
      throw new ConvexError("Profile image reference is inconsistent.");
    await ctx.db.patch(previous._id, { status: "deleted", expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  }
  const fields = slot === "avatar" ? { avatarAssetId: assetId } : { coverAssetId: assetId, externalCoverUrl };
  if (appearance) await ctx.db.patch(appearance._id, fields);
  else await ctx.db.insert("userAppearance", { userId: owner.user._id, avatarAssetId: null, ...fields });
  await writeProfile(ctx, owner, { revision });
  return { revision };
}
export async function publishPersonalImage(ctx: MutationCtx, asset: Doc<"assets">) {
  if (asset.avatarRevision === undefined) throw new ConvexError("Profile image intent is missing.");
  const access = await requireAppearanceWrite(ctx, asset.avatarRevision);
  if (asset.avatarUserId !== access.owner.user._id) throw new ConvexError("Profile image owner mismatch.");
  const slot = asset.purpose === "userAvatar" ? "avatar" : "cover";
  await replacePersonalImage(ctx, access, slot, asset._id);
  await ctx.db.patch(asset._id, { avatarPublishedRevision: access.revision });
}
export async function personalImageDescriptor(
  ctx: QueryCtx,
  appearance: Doc<"userAppearance"> | null,
  slot: Infer<typeof personalImageSlot>,
  readWorkspaceId?: Id<"workspaces">
) {
  const assetId = appearance?.[personalImageSlots[slot].field];
  const asset = assetId ? await ctx.db.get(assetId) : null;
  if (
    assetId &&
    (!asset ||
      asset.purpose !== personalImageSlots[slot].purpose ||
      asset.avatarUserId !== appearance?.userId ||
      asset.status !== "ready")
  )
    throw new ConvexError("Profile image reference is inconsistent.");
  if (!asset) return null;
  const image = descriptor(asset);
  return {
    ...image,
    downloadPath: readWorkspaceId ? `${image.downloadPath}?workspace=${readWorkspaceId}` : image.downloadPath,
  };
}
