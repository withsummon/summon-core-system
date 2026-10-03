import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireWorkspaceForUser } from "../identity/access";
import { requireUser } from "../identity/session";
export async function requireConversation(ctx: QueryCtx, conversationId: Id<"assistantConversations">, write = false) {
  return requireConversationForUser(ctx, conversationId, await requireUser(ctx), write);
}
export async function requireConversationForUser(
  ctx: QueryCtx,
  conversationId: Id<"assistantConversations">,
  user: Doc<"users">,
  write = false
) {
  const conversation = await ctx.db.get(conversationId);
  if (!conversation || conversation.deleted) throw new ConvexError("Conversation not found.");
  const access = await requireWorkspaceForUser(ctx, conversation.workspaceId, user, write);
  if (conversation.ownerId !== access.user._id) throw new ConvexError("Conversation access denied.");
  return { ...access, conversation };
}
