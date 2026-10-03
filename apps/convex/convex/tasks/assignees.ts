import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import { query } from "../_generated/server";
import { requireProject } from "../identity/access";
import { personalImageDescriptor, userAppearance } from "../identity/avatar_owner";
import { pageBudget } from "../commercial/validation";
import schema from "../schema";
export const list = query({
  args: { projectId: v.id("projects"), search: v.optional(v.string()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { project } = await requireProject(ctx, args.projectId);
    const search = (args.search ?? "").trim().toLowerCase();
    return stream(ctx.db, schema)
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", args.projectId))
      .map(async (membership) => {
        if (!membership.active || membership.role === "guest") return null;
        const workspaceMember = await ctx.db
          .query("workspaceMembers")
          .withIndex("by_workspace_user", (q) =>
            q.eq("workspaceId", project.workspaceId).eq("userId", membership.userId)
          )
          .unique();
        if (!workspaceMember?.active || workspaceMember.role === "guest") return null;
        const user = await ctx.db.get(membership.userId);
        if (!user) return null;
        const profile = search
          ? await ctx.db
              .query("userProfiles")
              .withIndex("by_user", (q) => q.eq("userId", user._id))
              .unique()
          : null;
        if (
          search &&
          !`${user.name ?? ""} ${profile?.firstName ?? ""} ${profile?.lastName ?? ""} ${user.email ?? ""}`
            .toLowerCase()
            .includes(search)
        )
          return null;
        return {
          id: user._id,
          name: user.name ?? null,
          email: user.email ?? null,
          avatar: await personalImageDescriptor(
            ctx,
            await userAppearance(ctx, user._id),
            "avatar",
            project.workspaceId
          ),
          selectable: true,
        };
      })
      .paginate(pageBudget(args.paginationOpts));
  },
});
