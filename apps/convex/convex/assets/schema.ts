import type { MutationCtx } from "../_generated/server";
import { apiIdSchema } from "../identity/schema";
import { defineTable } from "convex/server";
import { ConvexError, v } from "convex/values";
import { zodToConvex } from "convex-helpers/server/zod4";
import { commentRequestId } from "../tasks/schema";

export const commentImageTarget = v.union(
  v.object({ taskId: v.id("tasks"), requestId: zodToConvex(commentRequestId), anchor: v.union(v.string(), v.null()) }),
  v.object({ taskId: v.id("tasks"), commentId: v.id("taskComments"), anchor: v.union(v.string(), v.null()) })
);

export const personalImageSlot = v.union(v.literal("avatar"), v.literal("cover"));
export const personalImagePurpose = v.union(v.literal("userAvatar"), v.literal("userCover"));
export const fileMetadataFields = {
  name: v.string(),
  contentType: v.string(),
  size: v.number(),
  sha256: v.string(),
};
export const assetScope = {
  commentUpload: v.optional(commentImageTarget),
  commentId: v.optional(v.id("taskComments")),
  draftId: v.optional(v.id("taskDrafts")),
  taskId: v.optional(v.id("tasks")),
  conversationId: v.optional(v.id("assistantConversations")),
  meetingId: v.optional(v.id("meetings")),
  automationJobId: v.optional(v.id("automationJobs")),
  exportJobId: v.optional(v.id("workspaceExports")),
  workspaceId: v.id("workspaces"),
  projectId: v.union(v.id("projects"), v.null()),
  documentId: v.union(v.id("documents"), v.null()),
};
export const assetTables = {
  assets: defineTable({
    apiId: zodToConvex(apiIdSchema),
    ...assetScope,
    workspaceId: v.union(v.id("workspaces"), v.null()),
    avatarUserId: v.optional(v.id("users")),
    avatarRevision: v.optional(v.number()),
    avatarPublishedRevision: v.optional(v.number()),
    projectCoverRevision: v.optional(v.number()),
    projectCoverFormRevision: v.optional(v.number()),
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
    .index("by_api_id", ["apiId"])
    .index("by_personal_user_purpose_status", ["avatarUserId", "purpose", "status"])
    .index("by_project_purpose_status", ["projectId", "purpose", "status"])
    .index("by_workspace_purpose_status", ["workspaceId", "purpose", "status"])
    .index("by_draft", ["draftId"])
    .index("by_draft_status_expiry", ["draftId", "status", "expiresAt"])
    .index("by_storage", ["storageId"])
    .index("by_task_status", ["taskId", "status"])
    .index("by_status_expiry", ["status", "expiresAt"]),
};

export async function allocateAssetApiId(ctx: MutationCtx) {
  const apiId = apiIdSchema.parse(crypto.randomUUID());
  const existing = await ctx.db
    .query("assets")
    .withIndex("by_api_id", (q) => q.eq("apiId", apiId))
    .unique();
  if (existing) throw new ConvexError("Asset API identifier already exists.");
  return apiId;
}
