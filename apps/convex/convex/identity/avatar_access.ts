import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { requireUser, requireWorkspace, requireWorkspaceForUser } from "./access";
import { personalImageDescriptor, userAppearance } from "./avatar_owner";
import { requireAccountUser } from "./session";
import { apiIdSchema } from "./schema";
export async function requirePersonalImageScope(
  ctx: QueryCtx,
  scope: Pick<
    Doc<"assets">,
    | "workspaceId"
    | "projectId"
    | "documentId"
    | "taskId"
    | "draftId"
    | "conversationId"
    | "documentCopyId"
    | "avatarUserId"
  >,
  write: boolean,
  readWorkspaceId?: Id<"workspaces">
) {
  const ownerId = scope.avatarUserId;
  if (
    !ownerId ||
    scope.workspaceId !== null ||
    scope.projectId ||
    scope.documentId ||
    scope.taskId ||
    scope.draftId ||
    scope.conversationId ||
    scope.documentCopyId
  )
    throw new ConvexError("Profile image scope is invalid.");
  const user = await requireUser(ctx);
  if (user._id === ownerId) return { user };
  if (write || !readWorkspaceId) throw new ConvexError("Profile image access denied.");
  await requireWorkspace(ctx, readWorkspaceId);
  const owner = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) => q.eq("workspaceId", readWorkspaceId).eq("userId", ownerId))
    .unique();
  if (!owner?.active) throw new ConvexError("Profile image access denied.");
  return { user };
}

// PATs read published avatars only. Foreign avatars require current membership
// for both accounts in the workspace identified by its public API UUID.
export async function requireApiAvatar(
  ctx: QueryCtx,
  userId: Id<"users">,
  rawAssetId: string,
  readWorkspaceApiId?: string
) {
  const user = await requireAccountUser(ctx, userId);
  const assetId = ctx.db.normalizeId("assets", rawAssetId);
  const asset = assetId ? await ctx.db.get(assetId) : null;
  if (!asset?.avatarUserId) throw new ConvexError("Avatar access denied.");
  const ownerId = asset.avatarUserId;
  if (ownerId !== user._id) {
    const apiId = apiIdSchema.safeParse(readWorkspaceApiId);
    if (!apiId.success) throw new ConvexError("Avatar access denied.");
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_api_id", (q) => q.eq("apiId", apiId.data))
      .unique();
    if (!workspace) throw new ConvexError("Avatar access denied.");
    await requireWorkspaceForUser(ctx, workspace._id, user);
    const owner = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspace._id).eq("userId", ownerId))
      .unique();
    if (!owner?.active) throw new ConvexError("Avatar access denied.");
  }
  const appearance = await userAppearance(ctx, ownerId);
  if (appearance?.avatarAssetId !== asset._id) throw new ConvexError("Avatar access denied.");
  // Current-pointer writes are owned by the personal-image publisher; its
  // descriptor validates the ready asset's exact purpose and account binding.
  await personalImageDescriptor(ctx, appearance, "avatar");
  return asset;
}
