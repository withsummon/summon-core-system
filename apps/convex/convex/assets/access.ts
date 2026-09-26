import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireWorkspace, requireProject } from "../identity/access";
import { requireDocument } from "../documents/access";

export async function requireAssetScope(
  ctx: QueryCtx,
  scope: Pick<Doc<"assets">, "workspaceId" | "projectId" | "documentId">,
  write: boolean
) {
  const access = await requireWorkspace(ctx, scope.workspaceId, write);
  if (scope.projectId) {
    const { project } = await requireProject(ctx, scope.projectId, write);
    if (project.workspaceId !== scope.workspaceId) throw new ConvexError("Project belongs to another workspace.");
  }
  if (scope.documentId) {
    const { document } = await requireDocument(ctx, scope.documentId, write);
    if (document.workspaceId !== scope.workspaceId) throw new ConvexError("Document belongs to another workspace.");
    if (scope.projectId && !document.projectIds.includes(scope.projectId))
      throw new ConvexError("Document is not linked to this project.");
    if (write && (document.isLocked || document.archived)) throw new ConvexError("Document is read-only.");
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
    createdBy: asset.createdBy,
    downloadPath: `/assets/${asset._id}`,
  };
}
