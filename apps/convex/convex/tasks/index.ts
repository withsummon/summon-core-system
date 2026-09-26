import { paginationOptsValidator } from "convex/server";
import { v, ConvexError } from "convex/values";
import { query, mutation } from "../_generated/server";
import { requireProject } from "../identity/access";
import { status } from "../schema";
// Application-owned page budgets; callers cannot expand them with pagination hints.
const MAX_PAGE_TASKS = 100;
const MAX_PAGE_BYTES = 1_048_576;

export const list = query({
  args: { projectId: v.id("projects"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireProject(ctx, args.projectId);
    if (
      !Number.isSafeInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > MAX_PAGE_TASKS
    )
      throw new ConvexError("Request an integer between 1 and 100 tasks per page.");
    return ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .paginate({ ...args.paginationOpts, maximumRowsRead: MAX_PAGE_TASKS, maximumBytesRead: MAX_PAGE_BYTES });
  },
});
export const create = mutation({
  args: { projectId: v.id("projects"), title: v.string(), description: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { user, project } = await requireProject(ctx, args.projectId, true);
    const title = args.title.trim();
    const description = args.description ?? "";
    if (!title || title.length > 255 || description.length > 100_000)
      throw new ConvexError("Enter a title up to 255 characters and a description up to 100,000 characters.");
    const taskId = await ctx.db.insert("tasks", {
      workspaceId: project.workspaceId,
      projectId: project._id,
      title,
      description,
      status: "todo",
      sequence: project.nextSequence,
      createdBy: user._id,
      updatedAt: Date.now(),
    });
    await ctx.db.patch(project._id, { nextSequence: project.nextSequence + 1 });
    await ctx.db.insert("taskEvents", {
      workspaceId: project.workspaceId,
      projectId: project._id,
      taskId,
      actorId: user._id,
      kind: "created",
      status: "todo",
    });
    return taskId;
  },
});
export const setStatus = mutation({
  args: { taskId: v.id("tasks"), status },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new ConvexError("Task not found.");
    const { user } = await requireProject(ctx, task.projectId, true);
    if (task.status === args.status) return;
    await ctx.db.patch(task._id, { status: args.status, updatedAt: Date.now() });
    await ctx.db.insert("taskEvents", {
      workspaceId: task.workspaceId,
      projectId: task.projectId,
      taskId: task._id,
      actorId: user._id,
      kind: "status_changed",
      status: args.status,
    });
  },
});
