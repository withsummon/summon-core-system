import { taskStateIsSelectable } from "../tasks/schema";
import { v } from "convex/values";
import { stream } from "convex-helpers/server/stream";
import schema from "../schema";
import { paginationOptsValidator } from "convex/server";
import { query } from "../_generated/server";
import { requireWorkspace } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { projectReader, projectSummary } from "./scope";
import { memberIdentity } from "../projects/directory";
const choiceArgs = { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator };
export const states = query({
  args: choiceArgs,
  handler: async (ctx, args) => {
    const access = await requireWorkspace(ctx, args.workspaceId);
    const read = projectReader(ctx, args.workspaceId, access.user._id);
    return stream(ctx.db, schema)
      .query("taskStates")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .map(async (row) => {
        const permission = await read(row.projectId);
        return permission && taskStateIsSelectable(row)
          ? { id: row._id, name: row.name, project: projectSummary(permission.project) }
          : null;
      })
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const labels = query({
  args: choiceArgs,
  handler: async (ctx, args) => {
    const access = await requireWorkspace(ctx, args.workspaceId);
    const read = projectReader(ctx, args.workspaceId, access.user._id);
    return stream(ctx.db, schema)
      .query("taskLabels")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .map(async (row) => {
        const permission = await read(row.projectId);
        return permission && !row.retiring
          ? { id: row._id, name: row.name, color: row.color, project: projectSummary(permission.project) }
          : null;
      })
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const people = query({
  args: choiceArgs,
  handler: async (ctx, args) => {
    const permission = await requireWorkspace(ctx, args.workspaceId);
    return stream(ctx.db, schema)
      .query("workspaceMembers")
      .withIndex("by_workspace_role_active", (q) => q.eq("workspaceId", args.workspaceId))
      .map(async (row) => {
        if (!row.active) return null;
        const identity = await memberIdentity(ctx, args.workspaceId, permission.member.role, row.userId, "");
        return identity ? { id: identity.userId, name: identity.fullName || identity.displayName } : null;
      })
      .paginate(pageBudget(args.paginationOpts));
  },
});
