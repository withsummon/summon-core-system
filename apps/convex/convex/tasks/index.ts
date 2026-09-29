import { taskIsActive, taskDetail, taskCanRead, requireTask } from "./access";
import { preparePropertyUpdate, applyPropertyUpdate } from "./property_updates";
import { syncPlainDescription } from "./description";
import { createPreparedTask } from "./create";
import { changeTaskStatus } from "./status";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import { v, ConvexError } from "convex/values";
import { query, mutation } from "../_generated/server";
import { requireProject, requireUser } from "../identity/access";
import { status, taskProperties } from "./schema";
import { parseTaskText } from "./properties";
import { taskChanged } from "./revision";
import { plainDescriptionHtml, taskRichContent } from "./rich_content";
import schema from "../schema";
// Application-owned page budgets; callers cannot expand them with pagination hints.
const MAX_PAGE_TASKS = 100;
const MAX_PAGE_BYTES = 1_048_576;

export const list = query({
  args: { projectId: v.id("projects"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user } = await requireProject(ctx, args.projectId);
    if (
      !Number.isSafeInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > MAX_PAGE_TASKS
    )
      throw new ConvexError("Request an integer between 1 and 100 tasks per page.");
    return stream(ctx.db, schema)
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .map(async (task) => {
        if (!taskIsActive(task) || !(await taskCanRead(ctx, task, user._id))) return null;
        return taskDetail(ctx, task);
      })
      .paginate({
        ...args.paginationOpts,
        maximumRowsRead: MAX_PAGE_TASKS,
        maximumBytesRead: MAX_PAGE_BYTES,
      });
  },
});
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    description: v.optional(v.string()),
    html: v.optional(v.string()),
    status: v.optional(status),
    properties: v.optional(v.object(taskProperties)),
    parent: v.optional(v.object({ taskId: v.id("tasks"), expectedUpdatedAt: v.number() })),
  },
  handler: async (ctx, args) => {
    const content = taskRichContent(args.html ?? plainDescriptionHtml(args.description ?? ""));
    return createPreparedTask(ctx, { ...args, description: content.description }, content.html);
  },
});
export const setStatus = mutation({
  args: { taskId: v.id("tasks"), status },
  handler: async (ctx, args) => {
    await changeTaskStatus(ctx, args);
  },
});

export const get = query({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const id = ctx.db.normalizeId("tasks", args.taskId);
    const task = id ? await ctx.db.get(id) : null;
    if (!task || task.status === "triage" || !(await taskCanRead(ctx, task, user._id))) return null;
    return taskDetail(ctx, { ...task, status: task.status });
  },
});
export const update = mutation({
  args: {
    taskId: v.id("tasks"),
    expectedUpdatedAt: v.number(),
    ...v.object({ title: v.string(), description: v.string(), status, ...taskProperties }).partial().fields,
  },
  handler: async (
    ctx,
    { taskId, expectedUpdatedAt, title: rawTitle, description, status: requestedStatus, ...properties }
  ) => {
    const prepared = await preparePropertyUpdate(ctx, taskId, expectedUpdatedAt, properties, requestedStatus);
    const text = parseTaskText(rawTitle ?? prepared.task.title, description ?? prepared.task.description);
    if (description !== undefined) await syncPlainDescription(ctx, prepared.task, description, prepared.user._id);
    await applyPropertyUpdate(ctx, prepared, text);
    return taskId;
  },
});
export const setTitle = mutation({
  args: { taskId: v.id("tasks"), expectedTitleUpdatedAt: v.number(), title: v.string() },
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId);
    const { user } = await requireProject(ctx, task.projectId, true);
    if (!Number.isSafeInteger(args.expectedTitleUpdatedAt) || args.expectedTitleUpdatedAt !== task.titleUpdatedAt)
      throw new ConvexError("This title changed while you were editing. Reopen the latest title before saving.");
    const { title } = parseTaskText(args.title, task.description);
    if (title === task.title) return { titleUpdatedAt: task.titleUpdatedAt, title };
    await ctx.db.patch(task._id, { title });
    const titleUpdatedAt = await taskChanged(ctx, task, user._id);
    return { titleUpdatedAt, title };
  },
});
