import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireWorkspace } from "../identity/access";
import { pageBudget } from "../commercial/validation";
/** Contributions, never a truncated total. Native registered account producers create human accounts only. */
export const page = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId);
    const result = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", args.workspaceId))
      .paginate(pageBudget(args.paginationOpts));
    const active = await Promise.all(
      result.page.map(async (membership) => membership.active && (await ctx.db.get(membership.userId)) !== null)
    );
    return { ...result, page: [{ activeMembers: active.filter(Boolean).length }] };
  },
});
