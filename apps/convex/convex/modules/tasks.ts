import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import { requireTask } from "../tasks/properties";
import { requireProject } from "../identity/access";
import { requireTaskRevision, taskChanged } from "../tasks/revision";
import { pageBudget } from "../commercial/validation";
import { requireModule, requireModuleRevision, requireEditableModule } from "./access";
export const set = mutation({
  args: {
    moduleId: v.id("modules"),
    taskId: v.id("tasks"),
    assigned: v.boolean(),
    expectedTaskUpdatedAt: v.number(),
    expectedModuleUpdatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const { module, user } = await requireModule(ctx, args.moduleId, true);
    requireEditableModule(module);
    requireModuleRevision(module, args.expectedModuleUpdatedAt);
    const task = await requireTask(ctx, args.taskId);
    if (task.projectId !== module.projectId) throw new ConvexError("Task belongs to another project.");
    const previous = await ctx.db
      .query("moduleTasks")
      .withIndex("by_module_task", (q) => q.eq("moduleId", module._id).eq("taskId", task._id))
      .unique();
    if (Boolean(previous) === args.assigned) return;
    requireTaskRevision(task, args.expectedTaskUpdatedAt);
    if (args.assigned) await ctx.db.insert("moduleTasks", { moduleId: module._id, taskId: task._id });
    else if (previous) await ctx.db.delete(previous._id);
    await taskChanged(ctx, task, user._id);
  },
});
export const list = query({
  args: { moduleId: v.id("modules"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireModule(ctx, args.moduleId);
    const result = await ctx.db
      .query("moduleTasks")
      .withIndex("by_module_task", (q) => q.eq("moduleId", args.moduleId))
      .paginate(pageBudget(args.paginationOpts));
    const tasks = await Promise.all(result.page.map((row) => ctx.db.get(row.taskId)));
    return { ...result, page: tasks.filter((task) => task !== null) };
  },
});
export const forTask = query({
  args: { taskId: v.id("tasks"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId);
    await requireProject(ctx, task.projectId);
    const result = await ctx.db
      .query("moduleTasks")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .paginate(pageBudget(args.paginationOpts));
    const modules = await Promise.all(result.page.map((row) => ctx.db.get(row.moduleId)));
    return {
      ...result,
      page: modules.filter((module) => module !== null).filter((module) => !module.deleted),
    };
  },
});
