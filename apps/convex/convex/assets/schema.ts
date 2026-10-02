import { defineTable } from "convex/server";
import { v } from "convex/values";

export const personalImageSlot = v.union(v.literal("avatar"), v.literal("cover"));
export const personalImagePurpose = v.union(v.literal("userAvatar"), v.literal("userCover"));
export const fileMetadataFields = {
  name: v.string(),
  contentType: v.string(),
  size: v.number(),
  sha256: v.string(),
};
export const assetScope = {
  draftId: v.optional(v.id("taskDrafts")),
  taskId: v.optional(v.id("tasks")),
  conversationId: v.optional(v.id("assistantConversations")),
  meetingId: v.optional(v.id("meetings")),
  workspaceId: v.id("workspaces"),
  projectId: v.union(v.id("projects"), v.null()),
  documentId: v.union(v.id("documents"), v.null()),
};
export const assetTables = {
  assets: defineTable({
    ...assetScope,
    workspaceId: v.union(v.id("workspaces"), v.null()),
    avatarUserId: v.optional(v.id("users")),
    avatarRevision: v.optional(v.number()),
    avatarPublishedRevision: v.optional(v.number()),
    projectCoverRevision: v.optional(v.number()),
    workspaceLogoRevision: v.optional(v.number()),
    workspaceLogoPublishedRevision: v.optional(v.number()),
    purpose: v.optional(v.union(v.literal("workspaceLogo"), v.literal("projectCover"), personalImagePurpose)),
    documentCopyId: v.optional(v.id("documentCopies")),
    // Required by the task attachment owner; absent on older, non-task assets.
    attachmentRevision: v.optional(v.number()),
    ...fileMetadataFields,
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
    .index("by_personal_user_purpose_status", ["avatarUserId", "purpose", "status"])
    .index("by_project_purpose_status", ["projectId", "purpose", "status"])
    .index("by_workspace_purpose_status", ["workspaceId", "purpose", "status"])
    .index("by_draft", ["draftId"])
    .index("by_draft_status_expiry", ["draftId", "status", "expiresAt"])
    .index("by_storage", ["storageId"])
    .index("by_task_status", ["taskId", "status"])
    .index("by_status_expiry", ["status", "expiresAt"]),
};
