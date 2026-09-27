import { ConvexError } from "convex/values";
import type { QueryCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { requireWorkspace } from "../../identity/access";
export async function requireDraft(ctx: QueryCtx, draftId: Id<"taskDrafts">) {
  const draft = await ctx.db.get(draftId);
  if (!draft) throw new ConvexError("Draft not found.");
  const access = await requireWorkspace(ctx, draft.workspaceId);
  if (draft.authorId !== access.user._id) throw new ConvexError("Draft not found.");
  if (!(await draftProjectReadable(ctx, draft, access.user._id)))
    throw new ConvexError("Draft project is unavailable.");
  return { draft, ...access };
}
export function draftRevision(actual: number, expected: number) {
  if (!Number.isSafeInteger(expected) || actual !== expected)
    throw new ConvexError("Draft changed. Review the latest draft and try again.");
  return Math.max(Date.now(), actual + 1);
}

export async function draftProjectReadable(ctx: QueryCtx, draft: Doc<"taskDrafts">, userId: Id<"users">) {
  const projectId = draft.projectId;
  if (!projectId) return true;
  const project = await ctx.db.get(projectId);
  if (!project || project.archived || project.workspaceId !== draft.workspaceId) return false;
  const member = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", userId))
    .unique();
  return !!member?.active;
}
