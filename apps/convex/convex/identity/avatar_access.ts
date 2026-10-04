import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { requireUser, requireWorkspace } from "./access";
import { personalImageDescriptor, userAppearance } from "./avatar_owner";
import { requireAccountUser } from "./session";
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

// A verified API key reads only its owner's currently published avatar. It does
// not grant the session asset owner's staged-image or workspace-sharing scope.
export async function requireApiAvatar(ctx: QueryCtx, userId: Id<"users">, rawAssetId: string) {
  const user = await requireAccountUser(ctx, userId);
  const appearance = await userAppearance(ctx, user._id);
  const assetId = ctx.db.normalizeId("assets", rawAssetId);
  if (!assetId || appearance?.avatarAssetId !== assetId) throw new ConvexError("Avatar access denied.");
  // Current-pointer writes are owned by the personal-image publisher; its
  // descriptor validates the ready asset's exact purpose and account binding.
  await personalImageDescriptor(ctx, appearance, "avatar");
  const asset = await ctx.db.get(assetId);
  if (!asset) throw new ConvexError("Avatar access denied.");
  return asset;
}
