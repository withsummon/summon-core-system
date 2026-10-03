import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireWorkspaceForUser, requireUser } from "../identity/access";

export async function canAccessDocument(
  ctx: QueryCtx,
  document: Doc<"documents">,
  userId: Id<"users">,
  write = false,
  scopedProjectId?: Id<"projects">
) {
  if (document.deleted) return false;
  const workspace = await ctx.db.get(document.workspaceId);
  if (!workspace || workspace.deletedAt != null) return false;
  const workspaceMember = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) => q.eq("workspaceId", document.workspaceId).eq("userId", userId))
    .unique();
  if (!workspaceMember?.active || (write && workspaceMember.role === "guest")) return false;
  const owner = document.ownedBy === userId;
  if (owner && !scopedProjectId) return true;
  if (document.access === "private" && !owner) return false;
  if (document.isGlobal && !scopedProjectId) return true;
  if (scopedProjectId && !document.projectIds.includes(scopedProjectId)) return false;
  const memberships = await Promise.all(
    (scopedProjectId ? [scopedProjectId] : document.projectIds).map(async (projectId) => {
      const project = await ctx.db.get(projectId);
      if (!project || project.workspaceId !== document.workspaceId || project.archived || project.deletedAt != null)
        return false;
      const member = await ctx.db
        .query("projectMembers")
        .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", userId))
        .unique();
      return Boolean(member?.active && (owner || member.role !== "guest" || (!write && project.guestViewAllFeatures)));
    })
  );
  return memberships.some(Boolean);
}

export async function requireDocument(ctx: QueryCtx, documentId: Id<"documents">, write = false) {
  return requireDocumentForUser(ctx, documentId, await requireUser(ctx), write);
}
export async function requireDocumentForUser(
  ctx: QueryCtx,
  documentId: Id<"documents">,
  user: Doc<"users">,
  write = false
) {
  const document = await ctx.db.get(documentId);
  if (!document || document.deleted) throw new ConvexError("Document not found.");
  const access = await requireWorkspaceForUser(ctx, document.workspaceId, user, write);
  if (!(await canAccessDocument(ctx, document, access.user._id, write)))
    throw new ConvexError("Document access denied.");
  return { ...access, document };
}

export function requireMetadataVersion(document: Doc<"documents">, expectedUpdatedAt: number) {
  if (expectedUpdatedAt !== document.updatedAt)
    throw new ConvexError("This document changed. Reopen it to review the latest version before trying again.");
}
