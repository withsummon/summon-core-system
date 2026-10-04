import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import schema from "../schema";
import { directoryPerson } from "../projects/directory";
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
    const { module, project, member } = await requireModule(ctx, args.moduleId);
    return stream(ctx.db, schema)
      .query("moduleMembers")
      .withIndex("by_module_user", (q) => q.eq("moduleId", module._id))
      .map(async (row) => {
        const membership = await ctx.db
          .query("projectMembers")
          .withIndex("by_project_user", (q) => q.eq("projectId", project._id).eq("userId", row.userId))
          .unique();
        return membership?.active && membership.workspaceId === project.workspaceId
          ? directoryPerson(ctx, row.userId, project.workspaceId, member.role)
          : null;
      })
      .paginate(pageBudget(args.paginationOpts));
  },
});

export const choices = query({
  args: { projectId: v.id("projects"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { project, member } = await requireProject(ctx, args.projectId);
    return stream(ctx.db, schema)
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", project._id))
      .map(async (row) =>
        row.active && row.workspaceId === project.workspaceId
          ? directoryPerson(ctx, row.userId, project.workspaceId, member.role)
          : null
      )
      .paginate(pageBudget(args.paginationOpts));
  },
});
