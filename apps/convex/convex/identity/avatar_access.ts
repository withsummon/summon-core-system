import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { requireUser, requireWorkspace } from "./access";
export async function requireAvatarScope(
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
    throw new ConvexError("Avatar scope is invalid.");
  const user = await requireUser(ctx);
  if (user._id === ownerId) return { user };
  if (write || !readWorkspaceId) throw new ConvexError("Avatar access denied.");
  await requireWorkspace(ctx, readWorkspaceId);
  const owner = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) => q.eq("workspaceId", readWorkspaceId).eq("userId", ownerId))
    .unique();
  if (!owner?.active) throw new ConvexError("Avatar access denied.");
  return { user };
}
