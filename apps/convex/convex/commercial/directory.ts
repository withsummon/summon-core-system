import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "../_generated/server";
import { requireWorkspace } from "../identity/access";
import { pageBudget } from "./validation";

export const members = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId);
    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.eq(q.field("active"), true))
      .paginate(pageBudget(args.paginationOpts));
    const users = await Promise.all(
      memberships.page.map(async (membership) => {
        const user = await ctx.db.get(membership.userId);
        return user ? { id: user._id, name: user.name ?? null, email: user.email ?? null } : null;
      })
    );
    return { ...memberships, page: users.filter((user) => user !== null) };
  },
});
