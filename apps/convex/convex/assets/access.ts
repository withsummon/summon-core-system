import { personalImagePurpose } from "./schema";
import { requireCommentImageScope } from "./commentImages";
import { requireNetworkScope, requireProjectDiscovery } from "../projects/network_access";
import { canAdministerProject } from "../projects/administration";
import { requirePersonalImageScope } from "../identity/avatar_access";
import { requireDraftAttachmentAccess } from "./draft_access";
import { requireTaskAttachmentAccess } from "./task_access";
import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireWorkspace, requireProject } from "../identity/access";
import { requireConversation } from "../assistant/access";
import { authorizedContext } from "../assistant/context";
import { requireDocument } from "../documents/access";
import { requireJob } from "../automation/access";
import { requireMeeting } from "../meetings/access";
import { isAudioAsset, recordingReadMaxBytes } from "./content";

async function requireProjectCoverScope(ctx: QueryCtx, scope: Parameters<typeof requireAssetScope>[1], write: boolean) {
  if (
    !scope.projectId ||
    [
      scope.documentId,
      scope.taskId,
      scope.draftId,
      scope.conversationId,
      scope.commentUpload,
      scope.commentId,
      scope.meetingId,
      scope.automationJobId,
      scope.avatarUserId,
      scope.documentCopyId,
    ].some(Boolean)
  )
    throw new ConvexError("Project covers require only their project scope.");
  const projectId = scope.projectId;
  if (write || scope.projectCoverFormRevision !== undefined) {
    const access = await requireNetworkScope(ctx, projectId);
    if (access.project.workspaceId !== scope.workspaceId) throw new ConvexError("Project cover scope mismatch.");
    if (!(await canAdministerProject(ctx, access.project, access.user._id, access.member.role)))
      throw new ConvexError("Only workspace or project administrators can change the cover.");
    if (
      scope.projectCoverFormRevision !== undefined &&
      (!write || scope._id) &&
      (scope.createdBy !== access.user._id || scope.expiresAt === undefined || scope.expiresAt <= Date.now())
    )
      throw new ConvexError("This project cover draft is unavailable.");
    return access;
  }
  const access = await requireProjectDiscovery(ctx, projectId);
  if (access.project.workspaceId !== scope.workspaceId) throw new ConvexError("Project cover scope mismatch.");
  if (!access.membership?.active) {
    const appearance = await ctx.db
      .query("projectAppearance")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .unique();
    if (!scope._id || appearance?.coverAssetId !== scope._id)
      throw new ConvexError("Project cover is not currently published.");
  }
  return access;
}

export async function requireAssetScope(
  ctx: QueryCtx,
  scope: Pick<
    Doc<"assets">,
    | "workspaceId"
    | "projectId"
    | "documentId"
    | "conversationId"
    | "taskId"
    | "draftId"
    | "documentCopyId"
    | "purpose"
    | "avatarUserId"
    | "meetingId"
    | "automationJobId"
    | "commentUpload"
    | "commentId"
    | "projectCoverFormRevision"
  > & { _id?: Id<"assets">; createdBy?: Id<"users">; expiresAt?: number },
  write: boolean,
  readWorkspaceId?: Id<"workspaces">
) {
  if (scope.projectCoverFormRevision !== undefined) {
    if (scope.purpose !== "projectCover") throw new ConvexError("Project cover draft scope is invalid.");
    return requireProjectCoverScope(ctx, scope, write);
  }
  if ([scope.commentUpload, scope.commentId].some(Boolean)) return requireCommentImageScope(ctx, scope, write);
  if (scope.automationJobId) return requireAutomationFileScope(ctx, scope, scope.automationJobId, write);
  if (scope.meetingId) return requireMeetingRecordingScope(ctx, scope, scope.meetingId, write);
  if (personalImagePurpose.members.some((purpose) => purpose.value === scope.purpose))
    return requirePersonalImageScope(ctx, scope, write, readWorkspaceId);
  if (scope.workspaceId === null || scope.avatarUserId !== undefined)
    throw new ConvexError("Workspace asset scope is invalid.");
  const workspaceScope = { ...scope, workspaceId: scope.workspaceId };
  if (scope.documentCopyId) throw new ConvexError("Document copy files are not published.");
  if (scope.purpose === "projectCover") return requireProjectCoverScope(ctx, scope, write);
  if (scope.purpose === "workspaceLogo") return requireWorkspaceLogoScope(ctx, workspaceScope, write);
  if (scope.draftId) {
    if ([scope.taskId, scope.projectId, scope.documentId, scope.conversationId].some(Boolean))
      throw new ConvexError("Draft assets cannot have another scope.");
    const permission = await requireDraftAttachmentAccess(ctx, scope.draftId);
    if (permission.draft.workspaceId !== scope.workspaceId) throw new ConvexError("Draft asset scope mismatch.");
    return permission;
  }
  if (scope.taskId) {
    return requireTaskScope(ctx, workspaceScope, scope.taskId, write);
  }
  const access = await requireWorkspace(ctx, scope.workspaceId, write);
  if (scope.conversationId) {
    await requireConversationScope(ctx, workspaceScope, scope.conversationId, write);
  }
  if (scope.projectId) {
    const { project } = await requireProject(ctx, scope.projectId, write);
    if (project.workspaceId !== scope.workspaceId) throw new ConvexError("Project belongs to another workspace.");
  }
  if (scope.documentId) {
    await requireDocumentScope(ctx, workspaceScope, scope.documentId, write);
  }
  return access;
}
async function requireWorkspaceLogoScope(
  ctx: QueryCtx,
  scope: Parameters<typeof requireAssetScope>[1] & { workspaceId: Id<"workspaces"> },
  write: boolean
) {
  if ([scope.projectId, scope.documentId, scope.taskId, scope.draftId, scope.conversationId].some(Boolean))
    throw new ConvexError("Workspace logos cannot have another scope.");
  const access = await requireWorkspace(ctx, scope.workspaceId);
  if (write && access.member.role !== "admin")
    throw new ConvexError("Only workspace administrators can change the logo.");
  return access;
}
async function requireAutomationFileScope(
  ctx: QueryCtx,
  scope: Parameters<typeof requireAssetScope>[1],
  automationJobId: Id<"automationJobs">,
  write: boolean
) {
  if (
    [
      scope.purpose,
      scope.avatarUserId,
      scope.documentId,
      scope.documentCopyId,
      scope.taskId,
      scope.draftId,
      scope.conversationId,
      scope.meetingId,
    ].some(Boolean)
  )
    throw new ConvexError("Generated files cannot have another content scope.");
  const access = await requireJob(ctx, automationJobId, write);
  if (scope.workspaceId !== access.job.workspaceId || scope.projectId !== access.job.projectId)
    throw new ConvexError("Generated file scope mismatch.");
  return access;
}

async function requireMeetingRecordingScope(
  ctx: QueryCtx,
  scope: Parameters<typeof requireAssetScope>[1],
  meetingId: Id<"meetings">,
  write: boolean
) {
  if (
    scope.workspaceId === null ||
    [
      scope.purpose,
      scope.avatarUserId,
      scope.documentId,
      scope.taskId,
      scope.draftId,
      scope.conversationId,
      scope.documentCopyId,
    ].some(Boolean)
  )
    throw new ConvexError("Meeting recordings cannot have another scope.");
  const access = await requireMeeting(ctx, scope.workspaceId, meetingId, write);
  if (access.meeting.projectId !== scope.projectId) throw new ConvexError("Meeting recording scope mismatch.");
  return access;
}
export async function requireAsset(
  ctx: QueryCtx,
  assetId: Id<"assets">,
  write = false,
  readWorkspaceId?: Id<"workspaces">
) {
  const asset = await ctx.db.get(assetId);
  if (!asset || asset.status !== "ready") throw new ConvexError("Asset not found.");
  const access = await requireAssetScope(ctx, asset, write, readWorkspaceId);
  return { ...access, asset };
}
export function descriptor(asset: Doc<"assets">) {
  return {
    id: asset._id,
    name: asset.name,
    contentType: asset.contentType,
    size: asset.size,
    workspaceId: asset.workspaceId,
    projectId: asset.projectId,
    documentId: asset.documentId,
    taskId: asset.taskId ?? null,
    draftId: asset.draftId ?? null,
    meetingId: asset.meetingId ?? null,
    createdBy: asset.createdBy,
    downloadPath: `/assets/${asset._id}`,
    downloadChunkBytes: isAudioAsset(asset) ? recordingReadMaxBytes : null,
  };
}

async function requireTaskScope(
  ctx: QueryCtx,
  scope: Pick<Doc<"assets">, "workspaceId" | "projectId" | "documentId" | "conversationId">,
  taskId: Id<"tasks">,
  write: boolean
) {
  if (scope.documentId || scope.conversationId) throw new ConvexError("Task assets cannot have another content scope.");
  const permission = await requireTaskAttachmentAccess(ctx, taskId, write);
  if (permission.task.workspaceId !== scope.workspaceId || permission.task.projectId !== scope.projectId)
    throw new ConvexError("Task asset scope does not match its task.");
  return permission;
}

async function requireConversationScope(
  ctx: QueryCtx,
  scope: Pick<Doc<"assets">, "workspaceId" | "projectId" | "documentId">,
  conversationId: Id<"assistantConversations">,
  write: boolean
) {
  if (scope.projectId || scope.documentId) throw new ConvexError("Conversation assets cannot have another scope.");
  const { conversation } = await requireConversation(ctx, conversationId, write);
  if (conversation.workspaceId !== scope.workspaceId)
    throw new ConvexError("Conversation belongs to another workspace.");
  await authorizedContext(ctx, conversation.workspaceId, conversation.context);
}

async function requireDocumentScope(
  ctx: QueryCtx,
  scope: Pick<Doc<"assets">, "workspaceId" | "projectId">,
  documentId: Id<"documents">,
  write: boolean
) {
  const { document } = await requireDocument(ctx, documentId, write);
  if (document.workspaceId !== scope.workspaceId) throw new ConvexError("Document belongs to another workspace.");
  if (scope.projectId && !document.projectIds.includes(scope.projectId))
    throw new ConvexError("Document is not linked to this project.");
  if (write && (document.isLocked || document.archived)) throw new ConvexError("Document is read-only.");
}

export function assetWorkspaceId(asset: Pick<Doc<"assets">, "workspaceId">) {
  if (asset.workspaceId === null) throw new ConvexError("This asset requires a workspace.");
  return asset.workspaceId;
}
