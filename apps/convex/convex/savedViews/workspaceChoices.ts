import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "../_generated/server";
import { requireWorkspace } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { projectReader, projectSummary } from "./scope";
const choiceArgs = { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator };
export const states = query({
  args: choiceArgs,
  handler: async (ctx, args) => {
    const access = await requireWorkspace(ctx, args.workspaceId);
    const read = projectReader(ctx, args.workspaceId, access.user._id);
    const result = await ctx.db
      .query("taskStates")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    const page = await Promise.all(
      result.page.map(async (row) => {
        const permission = await read(row.projectId);
        return permission && row.status !== "triage"
          ? { id: row._id, name: row.name, project: projectSummary(permission.project) }
          : null;
      })
    );
    return { ...result, page: page.filter((row) => row !== null) };
  },
});
export const labels = query({
  args: choiceArgs,
  handler: async (ctx, args) => {
    const access = await requireWorkspace(ctx, args.workspaceId);
    const read = projectReader(ctx, args.workspaceId, access.user._id);
    const result = await ctx.db
      .query("taskLabels")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    const page = await Promise.all(
      result.page.map(async (row) => {
        const permission = await read(row.projectId);
        return permission ? { id: row._id, name: row.name, project: projectSummary(permission.project) } : null;
      })
    );
    return { ...result, page: page.filter((row) => row !== null) };
  },
});
export const people = query({
  args: choiceArgs,
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId);
    const result = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_role_active", (q) => q.eq("workspaceId", args.workspaceId))
      .paginate(pageBudget(args.paginationOpts));
    const page = await Promise.all(
      result.page.map(async (row) => {
        if (!row.active) return null;
        const user = await ctx.db.get(row.userId);
        return user ? { id: user._id, name: user.name ?? null } : null;
      })
    );
    return { ...result, page: page.filter((row) => row !== null) };
  },
});
