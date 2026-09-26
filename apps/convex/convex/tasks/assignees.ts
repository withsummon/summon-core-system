import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "../_generated/server";
import { requireProject } from "../identity/access";
import { pageBudget } from "../commercial/validation";
export const list = query({
  args: { projectId: v.id("projects"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { project } = await requireProject(ctx, args.projectId);
    const result = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.and(q.eq(q.field("active"), true), q.neq(q.field("role"), "guest")))
      .paginate(pageBudget(args.paginationOpts));
    const visible = await Promise.all(
      result.page.map(async (membership) => {
        const workspaceMember = await ctx.db
          .query("workspaceMembers")
          .withIndex("by_workspace_user", (q) =>
            q.eq("workspaceId", project.workspaceId).eq("userId", membership.userId)
          )
          .unique();
        if (!workspaceMember?.active || workspaceMember.role === "guest") return null;
        const user = await ctx.db.get(membership.userId);
        return user ? { id: user._id, name: user.name ?? null, email: user.email ?? null } : null;
      })
    );
    return { ...result, page: visible.filter((user) => user !== null) };
  },
});
