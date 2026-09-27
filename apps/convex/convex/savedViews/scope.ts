import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
export function workspaceScope(view: Doc<"savedViews">) {
  if (!view.workspaceId) throw new ConvexError("Saved view workspace migration is required.");
  return view.workspaceId;
}
// Check only projects referenced by this bounded page; do not enumerate the workspace's projects.
export function projectReader(ctx: QueryCtx, workspaceId: Id<"workspaces">, userId: Id<"users">) {
  const cache = new Map<Id<"projects">, Promise<{ project: Doc<"projects">; member: Doc<"projectMembers"> } | null>>();
  return (projectId: Id<"projects">) => {
    let result = cache.get(projectId);
    if (!result) {
      result = (async () => {
        const project = await ctx.db.get(projectId);
        if (!project || project.archived || project.workspaceId !== workspaceId) return null;
        const member = await ctx.db
          .query("projectMembers")
          .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", userId))
          .unique();
        return member?.active ? { project, member } : null;
      })();
      cache.set(projectId, result);
    }
    return result;
  };
}
export function projectSummary(project: Doc<"projects">) {
  return { id: project._id, name: project.name, identifier: project.identifier };
}
