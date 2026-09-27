import { requireTask, taskIsActive, taskDetail } from "./access";
import { recordTaskEvent } from "../notifications/delivery";
import { syncPlainDescription } from "./description";
import { requireParent } from "./hierarchy";
import { createTask } from "./create";
import { requireTaskRevision } from "./revision";
import { changeTaskStatus } from "./status";
import { paginationOptsValidator } from "convex/server";
import { v, ConvexError } from "convex/values";
import { query, mutation } from "../_generated/server";
import { requireProject } from "../identity/access";
import { status, taskProperties } from "./schema";
import { initialProperties, validateProperties, parseTaskText } from "./properties";
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
    const result = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        maximumRowsRead: MAX_PAGE_TASKS,
        maximumBytesRead: MAX_PAGE_BYTES,
      });
    return { ...result, page: result.page.filter(taskIsActive) };
  },
});
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.optional(status),
    properties: v.optional(v.object(taskProperties)),
    parent: v.optional(v.object({ taskId: v.id("tasks"), expectedUpdatedAt: v.number() })),
  },
  handler: async (ctx, args) => {
    const { user, project } = await requireProject(ctx, args.projectId, true);
    const { title, description } = parseTaskText(args.title, args.description ?? "");
    const parent = args.parent
      ? await requireParent(ctx, project._id, args.parent.taskId, args.parent.expectedUpdatedAt)
      : null;
    const defaultState = await ctx.db
      .query("taskStates")
      .withIndex("by_project_default", (q) => q.eq("projectId", project._id).eq("isDefault", true))
      .unique();
    const { data, state } = await validateProperties(
      ctx,
      project,
      args.properties ?? { ...initialProperties, stateId: defaultState?._id ?? null }
    );
    if (state && args.status && state.status !== args.status)
      throw new ConvexError("Task status must match its custom state.");
    const nextStatus = state?.status ?? args.status ?? "todo";
    return createTask(ctx, project, user._id, { title, description, ...data, status: nextStatus }, parent);
  },
});
export const setStatus = mutation({
  args: { taskId: v.id("tasks"), status },
  handler: async (ctx, args) => {
    await changeTaskStatus(ctx, args);
  },
});

export const get = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId, "read");
    return taskDetail(ctx, task);
  },
});
export const update = mutation({
  args: {
    taskId: v.id("tasks"),
    expectedUpdatedAt: v.number(),
    title: v.string(),
    description: v.string(),
    status,
    ...taskProperties,
  },
  handler: async (
    ctx,
    { taskId, expectedUpdatedAt, title: rawTitle, description, status: requestedStatus, ...properties }
  ) => {
    const task = await requireTask(ctx, taskId);
    const { user, project } = await requireProject(ctx, task.projectId, true);
    requireTaskRevision(task, expectedUpdatedAt);
    const { title } = parseTaskText(rawTitle, description);
    await syncPlainDescription(ctx, task, description, user._id);
    const { data, state } = await validateProperties(ctx, project, properties);
    if (state && state.status !== requestedStatus) throw new ConvexError("Task status must match its custom state.");
    const statusChanged = task.status !== requestedStatus || task.stateId !== data.stateId;
    const completedAt = statusChanged ? (requestedStatus === "done" ? Date.now() : null) : task.completedAt;
    await ctx.db.patch(taskId, {
      ...data,
      title,
      description,
      status: requestedStatus,
      completedAt,
      updatedAt: Math.max(Date.now(), task.updatedAt + 1),
    });
    await recordTaskEvent(ctx, {
      workspaceId: task.workspaceId,
      projectId: task.projectId,
      taskId,
      actorId: user._id,
      kind: statusChanged ? "status_changed" : "updated",
      status: requestedStatus,
    });
    return taskId;
  },
});

export const resolve = query({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    const taskId = ctx.db.normalizeId("tasks", args.taskId);
    if (!taskId) throw new ConvexError("Task not found.");
    const task = await requireTask(ctx, taskId, "read");
    return taskDetail(ctx, task);
  },
});
