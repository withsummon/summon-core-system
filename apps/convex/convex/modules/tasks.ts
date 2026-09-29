import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import schema from "../schema";
import { mutation, query } from "../_generated/server";
import { requireTask, taskIsActive, taskCanRead, taskDetail } from "../tasks/access";
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
export const setMany = mutation({
  args: {
    moduleId: v.id("modules"),
    expectedModuleUpdatedAt: v.number(),
    assigned: v.boolean(),
    tasks: v.array(v.object({ taskId: v.id("tasks"), expectedTaskUpdatedAt: v.number() })),
  },
  handler: async (ctx, args) => {
    if (
      args.tasks.length < 1 ||
      args.tasks.length > 100 ||
      new Set(args.tasks.map((task) => task.taskId)).size !== args.tasks.length
    )
      throw new ConvexError("Choose between 1 and 100 distinct work items per operation.");
    await Promise.all(
      args.tasks.map((task) =>
        setModuleTask(ctx, {
          moduleId: args.moduleId,
          expectedModuleUpdatedAt: args.expectedModuleUpdatedAt,
          assigned: args.assigned,
          ...task,
        })
      )
    );
  },
});
export const list = query({
  args: { moduleId: v.id("modules"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { module, user, member, projectMember } = await requireModule(ctx, args.moduleId);
    const canDetach = member.role !== "guest" && projectMember.role !== "guest" && !module.archived;
    return stream(ctx.db, schema)
      .query("moduleTasks")
      .withIndex("by_module_task", (q) => q.eq("moduleId", args.moduleId))
      .map(async (row) => {
        const task = await ctx.db.get(row.taskId);
        if (!task || task.projectId !== module.projectId || task.workspaceId !== module.workspaceId) return null;
        const readable = taskIsActive(task) && (await taskCanRead(ctx, task, user._id));
        if (!readable && !canDetach) return null;
        return {
          taskId: task._id,
          updatedAt: task.updatedAt,
          task: readable ? await taskDetail(ctx, task) : null,
          unavailable: !taskIsActive(task),
        };
      })
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const forTask = query({
  args: { taskId: v.id("tasks"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId, "read");
    await requireProject(ctx, task.projectId);
    return stream(ctx.db, schema)
      .query("moduleTasks")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .map(async (row) => {
        const module = await ctx.db.get(row.moduleId);
        return module && !module.deleted ? module : null;
      })
      .paginate(pageBudget(args.paginationOpts));
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
