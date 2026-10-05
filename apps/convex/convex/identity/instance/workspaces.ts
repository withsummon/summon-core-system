import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import schema from "../../schema";
import { query, mutation } from "../../_generated/server";
import { requireInstanceAdmin } from "./access";
import { createWorkspace, workspaceCreateInput } from "../../workspaces/index";
import { pageBudget, text } from "../../commercial/validation";
import { profileIdentity } from "../profile_owner";
import { workspaceLogo } from "../../settings/logo_owner";

export const list = query({
  args: { search: v.optional(v.string()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireInstanceAdmin(ctx);
    const search = text(args.search ?? "", "Workspace search", 255).toLowerCase();
    return stream(ctx.db, schema)
      .query("workspaces")
      .order("desc")
      .map(async (workspace) => {
        if (workspace.deletedAt != null || !workspace.name.toLowerCase().includes(search)) return null;
        const owner = workspace.ownerId ? await profileIdentity(ctx, workspace.ownerId) : null;
        if (workspace.ownerId && !owner) throw new Error("Workspace ownership references an unavailable account.");
        return Object.assign(workspace, { owner, logo: await workspaceLogo(ctx, workspace._id) });
      })
      .paginate(pageBudget(args.paginationOpts, 10));
  },
});

// Counts are exact only after exhausting each contribution cursor. These reads
// reveal no task content and never grant workspace or project membership.
export const projects = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireInstanceAdmin(ctx);
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.deletedAt != null) throw new ConvexError("Workspace not found.");
    return stream(ctx.db, schema)
      .query("projects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
      .map(async (project) => (project.deletedAt == null ? { projectId: project._id } : null))
      .paginate(pageBudget(args.paginationOpts));
  },
});

export const members = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireInstanceAdmin(ctx);
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.deletedAt != null) throw new ConvexError("Workspace not found.");
    return stream(ctx.db, schema)
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspace._id))
      .map(async (membership) => {
        if (!membership.active) return null;
        if (!(await ctx.db.get(membership.userId)))
          throw new Error("Workspace membership references an unavailable account.");
        return { membershipId: membership._id };
      })
      .paginate(pageBudget(args.paginationOpts));
  },
});

export const create = mutation({
  args: workspaceCreateInput.fields,
  handler: async (ctx, args) => {
    const { user } = await requireInstanceAdmin(ctx);
    return (await createWorkspace(ctx, user, args)).workspaceId;
  },
});
