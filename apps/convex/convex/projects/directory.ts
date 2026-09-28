import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "../_generated/server";
import { requireProjectDiscovery } from "./network_access";
import { pageBudget } from "../commercial/validation";
import { memberLabel } from "../../shared/member-label";
import { personalImageDescriptor, userAppearance } from "../identity/avatar_owner";
// Each returned row contributes one currently active human member. The total
// requires cursor exhaustion; there is no silently truncated member count.
export const members = query({
  args: { projectId: v.id("projects"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { project } = await requireProjectDiscovery(ctx, args.projectId);
    const result = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", project._id))
      .paginate(pageBudget(args.paginationOpts));
    const page = await Promise.all(
      result.page.map(async (row) => {
        if (!row.active || row.workspaceId !== project.workspaceId) return null;
        const membership = await ctx.db
          .query("workspaceMembers")
          .withIndex("by_workspace_user", (q) => q.eq("workspaceId", project.workspaceId).eq("userId", row.userId))
          .unique();
        const user = await ctx.db.get(row.userId);
        if (!membership?.active || !user) return null;
        return {
          userId: user._id,
          name: memberLabel({ id: user._id, name: user.name, email: user.email }),
          avatar: await personalImageDescriptor(
            ctx,
            await userAppearance(ctx, user._id),
            "avatar",
            project.workspaceId
          ),
        };
      })
    );
    return { ...result, page: page.filter((row) => row !== null) };
  },
});
