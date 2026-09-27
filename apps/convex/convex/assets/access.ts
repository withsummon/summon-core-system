import { requireTaskAttachmentAccess } from "./task_access";
import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireWorkspace, requireProject } from "../identity/access";
import { requireConversation } from "../assistant/access";
import { authorizedContext } from "../assistant/context";
import { requireDocument } from "../documents/access";

export async function requireAssetScope(
  ctx: QueryCtx,
  scope: Pick<Doc<"assets">, "workspaceId" | "projectId" | "documentId" | "conversationId" | "taskId">,
  write: boolean
) {
  if (scope.taskId) {
    return requireTaskScope(ctx, scope, scope.taskId, write);
  }
  const access = await requireWorkspace(ctx, scope.workspaceId, write);
  if (scope.conversationId) {
    await requireConversationScope(ctx, scope, scope.conversationId, write);
  }
  if (scope.projectId) {
    const { project } = await requireProject(ctx, scope.projectId, write);
    if (project.workspaceId !== scope.workspaceId) throw new ConvexError("Project belongs to another workspace.");
  }
  if (scope.documentId) {
    await requireDocumentScope(ctx, scope, scope.documentId, write);
  }
  return access;
}
export async function requireAsset(ctx: QueryCtx, assetId: Id<"assets">, write = false) {
  const asset = await ctx.db.get(assetId);
  if (!asset || asset.status !== "ready") throw new ConvexError("Asset not found.");
  const access = await requireAssetScope(ctx, asset, write);
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
    createdBy: asset.createdBy,
    downloadPath: `/assets/${asset._id}`,
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
