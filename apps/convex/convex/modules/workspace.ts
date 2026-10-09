import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import { query } from "../_generated/server";
import schema from "../schema";
import { requireWorkspace } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { projectReader, projectSummary } from "../savedViews/scope";
export const list = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    const read = projectReader(ctx, args.workspaceId, user._id);
    return stream(ctx.db, schema)
      .query("modules")
      .withIndex("by_workspace", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("deleted", false).eq("archived", false)
      )
      .order("desc")
      .map(async (module) => {
        const access = await read(module.projectId);
        return access ? { module, project: projectSummary(access.project) } : null;
      })
      .paginate(pageBudget(args.paginationOpts));
  },
});
