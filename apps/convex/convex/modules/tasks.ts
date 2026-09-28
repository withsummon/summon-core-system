import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import { requireTask, taskIsActive, taskCanRead } from "../tasks/access";
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
  handler: setModuleTask,
});
export const list = query({
  args: { moduleId: v.id("modules"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { module, user, member, projectMember } = await requireModule(ctx, args.moduleId);
    const canDetach = member.role !== "guest" && projectMember.role !== "guest" && !module.archived;
    const result = await ctx.db
      .query("moduleTasks")
      .withIndex("by_module_task", (q) => q.eq("moduleId", args.moduleId))
      .paginate(pageBudget(args.paginationOpts));
    const tasks = await Promise.all(result.page.map((row) => ctx.db.get(row.taskId)));
    const readable = new Set(
      (
        await Promise.all(
          tasks.map(async (task) => (task && (await taskCanRead(ctx, task, user._id)) ? task._id : null))
        )
      ).filter((id) => id !== null)
    );
    return {
      ...result,
      page: tasks
        .filter((task) => task !== null)
        .filter((task) => (taskIsActive(task) && readable.has(task._id)) || canDetach)
        .map((task) => ({
          taskId: task._id,
          updatedAt: task.updatedAt,
          task: taskIsActive(task) && readable.has(task._id) ? task : null,
          unavailable: !taskIsActive(task),
        })),
    };
  },
});
export const forTask = query({
  args: { taskId: v.id("tasks"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId, "read");
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

export async function setModuleTask(
  ctx: MutationCtx,
  args: {
    moduleId: Id<"modules">;
    taskId: Id<"tasks">;
    assigned: boolean;
    expectedTaskUpdatedAt: number;
    expectedModuleUpdatedAt: number;
  }
) {
  const { module, user } = await requireModule(ctx, args.moduleId, true);
  requireEditableModule(module);
  requireModuleRevision(module, args.expectedModuleUpdatedAt);
  const task = args.assigned ? await requireTask(ctx, args.taskId) : await ctx.db.get(args.taskId);
  if (!task) throw new ConvexError("Task not found.");
  if (task.projectId !== module.projectId) throw new ConvexError("Task belongs to another project.");
  const previous = await ctx.db
    .query("moduleTasks")
    .withIndex("by_module_task", (q) => q.eq("moduleId", module._id).eq("taskId", task._id))
    .unique();
  if (Boolean(previous) === args.assigned) return;
  requireTaskRevision(task, args.expectedTaskUpdatedAt);
  if (args.assigned) await ctx.db.insert("moduleTasks", { moduleId: module._id, taskId: task._id });
  else if (previous) await ctx.db.delete(previous._id);
  await taskChanged(ctx, task, user._id, {
    kind: "updated",
    changes: [
      {
        field: "modules",
        added: args.assigned ? [{ id: module._id, name: module.name }] : [],
        removed: args.assigned ? [] : [{ id: module._id, name: module.name }],
      },
    ],
  });
}
