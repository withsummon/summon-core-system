import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "../_generated/server";
import { requireWorkspace } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { projectReader, projectSummary } from "../savedViews/scope";
export const list = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    const read = projectReader(ctx, args.workspaceId, user._id);
    const result = await ctx.db
      .query("modules")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("deleted", false).eq("archived", false)
      )
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    const page = await Promise.all(
      result.page.map(async (module) => {
        const access = await read(module.projectId);
        return access ? { module, project: projectSummary(access.project) } : null;
      })
    );
    return { ...result, page: page.filter((row) => row !== null) };
  },
});
