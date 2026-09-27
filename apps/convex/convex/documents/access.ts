import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireWorkspace, requireUser } from "../identity/access";

export async function canAccessDocument(ctx: QueryCtx, document: Doc<"documents">, userId: Id<"users">, write = false) {
  if (document.deleted) return false;
  if (document.ownedBy === userId) return true;
  if (document.access === "private") return false;
  if (document.isGlobal) return true;
  const memberships = await Promise.all(
    document.projectIds.map(async (projectId) => {
      const project = await ctx.db.get(projectId);
      if (!project || project.archived) return false;
      const member = await ctx.db
        .query("projectMembers")
        .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", userId))
        .unique();
      return Boolean(member?.active && (!write || member.role !== "guest"));
    })
  );
  return memberships.some(Boolean);
}

export async function requireDocument(ctx: QueryCtx, documentId: Id<"documents">, write = false) {
  await requireUser(ctx);
  const document = await ctx.db.get(documentId);
  if (!document || document.deleted) throw new ConvexError("Document not found.");
  const access = await requireWorkspace(ctx, document.workspaceId, write);
  if (!(await canAccessDocument(ctx, document, access.user._id, write)))
    throw new ConvexError("Document access denied.");
  return { ...access, document };
}

export function requireMetadataVersion(document: Doc<"documents">, expectedUpdatedAt: number) {
  if (expectedUpdatedAt !== document.updatedAt)
    throw new ConvexError("This document changed while you were editing. Reopen its latest settings before saving.");
}
