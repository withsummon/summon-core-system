import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import { requireProject } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { requireModule, requireModuleRevision, requireEditableModule, requireModulePerson } from "./access";
export const set = mutation({
  args: {
    moduleId: v.id("modules"),
    userId: v.id("users"),
    assigned: v.boolean(),
    expectedUpdatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const { module, project } = await requireModule(ctx, args.moduleId, true);
    requireEditableModule(module);
    requireModuleRevision(module, args.expectedUpdatedAt);
    const previous = await ctx.db
      .query("moduleMembers")
      .withIndex("by_module_user", (q) => q.eq("moduleId", module._id).eq("userId", args.userId))
      .unique();
    if (Boolean(previous) === args.assigned) return;
    if (args.assigned) {
      await requireModulePerson(ctx, project, args.userId);
      await ctx.db.insert("moduleMembers", { moduleId: module._id, userId: args.userId });
    } else if (previous) await ctx.db.delete(previous._id);
    await ctx.db.patch(module._id, { updatedAt: Math.max(Date.now(), module.updatedAt + 1) });
  },
});
export const list = query({
  args: { moduleId: v.id("modules"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireModule(ctx, args.moduleId);
    const result = await ctx.db
      .query("moduleMembers")
      .withIndex("by_module_user", (q) => q.eq("moduleId", args.moduleId))
      .paginate(pageBudget(args.paginationOpts));
    const users = await Promise.all(
      result.page.map(async (row) => {
        const user = await ctx.db.get(row.userId);
        return { userId: row.userId, name: user?.name ?? null, email: user?.email ?? null };
      })
    );
    return { ...result, page: users };
  },
});

export const choices = query({
  args: { projectId: v.id("projects"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { project } = await requireProject(ctx, args.projectId);
    const result = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", project._id))
      .paginate(pageBudget(args.paginationOpts));
    const users = await Promise.all(
      result.page.map(async (member) => {
        if (!member.active) return null;
        const workspaceMember = await ctx.db
          .query("workspaceMembers")
          .withIndex("by_workspace_user", (q) => q.eq("workspaceId", project.workspaceId).eq("userId", member.userId))
          .unique();
        if (!workspaceMember?.active) return null;
        const user = await ctx.db.get(member.userId);
        return user ? { id: user._id, name: user.name ?? null, email: user.email ?? null } : null;
      })
    );
    return { ...result, page: users.filter((user) => user !== null) };
  },
});
