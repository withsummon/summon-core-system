import { defineTable } from "convex/server";
import { v } from "convex/values";

export const assetScope = {
  conversationId: v.optional(v.id("assistantConversations")),
  workspaceId: v.id("workspaces"),
  projectId: v.union(v.id("projects"), v.null()),
  documentId: v.union(v.id("documents"), v.null()),
};
export const assetTables = {
  assets: defineTable({
    ...assetScope,
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
    sha256: v.string(),
    createdBy: v.id("users"),
    storageId: v.union(v.id("_storage"), v.null()),
    status: v.union(
      v.literal("pending"),
      v.literal("ready"),
      v.literal("rejected"),
      v.literal("expired"),
      v.literal("deleted")
    ),
    expiresAt: v.number(),
  })
    .index("by_storage", ["storageId"])
    .index("by_status_expiry", ["status", "expiresAt"]),
};
