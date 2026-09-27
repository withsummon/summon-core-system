import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query, internalMutation } from "../_generated/server";
import { requireProject } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { requireTask, taskDetail } from "./access";
import { requireTaskRevision, taskChanged } from "./revision";
export const change = mutation({
  args: {
    taskId: v.id("tasks"),
    expectedUpdatedAt: v.number(),
    operation: v.union(v.literal("archive"), v.literal("unarchive"), v.literal("delete"), v.literal("restore")),
  },
  handler: async (ctx, args) => {
    const recovery = args.operation === "delete" || args.operation === "restore";
    const task = await requireTask(ctx, args.taskId, recovery ? "recovery" : "read");
    const { user } = await requireProject(ctx, task.projectId, !recovery);
    requireTaskRevision(task, args.expectedUpdatedAt);
    if (recovery) {
      if ((task.deletedAt != null) === (args.operation === "delete")) return;
      await ctx.db.patch(task._id, { deletedAt: args.operation === "delete" ? Date.now() : null });
    } else {
      if (args.operation === "archive" && task.status !== "done" && task.status !== "cancelled")
        throw new ConvexError("Only completed or cancelled tasks can be archived.");
      if ((task.archivedAt != null) === (args.operation === "archive")) return;
      await ctx.db.patch(task._id, {
        archivedAt: args.operation === "archive" ? Date.now() : null,
      });
    }
    await taskChanged(ctx, task, user._id);
  },
});
export const list = query({
  args: {
    projectId: v.id("projects"),
    view: v.union(v.literal("archived"), v.literal("deleted")),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { user, projectMember } = await requireProject(ctx, args.projectId);
    const result = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    return {
      ...result,
      page: result.page.filter((task) =>
        args.view === "deleted"
          ? task.deletedAt != null && (task.createdBy === user._id || projectMember.role === "admin")
          : task.deletedAt == null && task.archivedAt != null
      ),
    };
  },
});
export const get = query({
  args: { taskId: v.string(), view: v.union(v.literal("archived"), v.literal("deleted")) },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("tasks", args.taskId);
    if (!id) throw new ConvexError("Task not found.");
    const task = await requireTask(ctx, id, args.view === "deleted" ? "recovery" : "read");
    if (args.view === "deleted" ? task.deletedAt == null : task.deletedAt != null || task.archivedAt == null)
      throw new ConvexError("Task not found.");
    return taskDetail(ctx, task);
  },
});
export const backfill = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const result = await ctx.db.query("tasks").paginate({
      cursor: args.cursor,
      numItems: 50,
      maximumRowsRead: 50,
      maximumBytesRead: 1_000_000,
    });
    let changed = 0;
    await Promise.all(
      result.page.map(async (task) => {
        if (task.archivedAt !== undefined && task.deletedAt !== undefined) return;
        await ctx.db.patch(task._id, {
          archivedAt: task.archivedAt ?? null,
          deletedAt: task.deletedAt ?? null,
        });
        changed++;
      })
    );
    return { changed, continueCursor: result.continueCursor, isDone: result.isDone };
  },
});
