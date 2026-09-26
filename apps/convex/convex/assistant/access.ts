import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireWorkspace } from "../identity/access";
export async function requireConversation(ctx: QueryCtx, conversationId: Id<"assistantConversations">, write = false) {
  const conversation = await ctx.db.get(conversationId);
  if (!conversation || conversation.deleted) throw new ConvexError("Conversation not found.");
  const access = await requireWorkspace(ctx, conversation.workspaceId, write);
  if (conversation.ownerId !== access.user._id) throw new ConvexError("Conversation access denied.");
  return { ...access, conversation };
}
