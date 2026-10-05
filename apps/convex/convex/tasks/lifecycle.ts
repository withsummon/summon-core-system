import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { Infer } from "convex/values";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import schema from "../schema";
import { mutation, query } from "../_generated/server";
import { requireProject, requireProjectForUser, requireUser } from "../identity/access";
import { pageBudget, text } from "../commercial/validation";
import { taskOrder, viewFilters } from "./schema";
import { matchesFilters, validateShape } from "../savedViews/filters";
import { requireTask, taskDetail, taskCanRead, taskRoleCanRead, taskOrdering } from "./access";
import { requireTaskRevision, taskChanged } from "./revision";
const MAX_BULK_TASKS = 20;
export const lifecycleOperation = v.union(
  v.literal("archive"),
  v.literal("unarchive"),
  v.literal("delete"),
  v.literal("restore")
);
async function prepareChange(
  ctx: MutationCtx,
  args: { taskId: Id<"tasks">; expectedUpdatedAt: number; operation: Infer<typeof lifecycleOperation> }
) {
  const recovery = args.operation === "delete" || args.operation === "restore";
  const task = await requireTask(ctx, args.taskId, recovery ? "recovery" : "read");
  const { user } = await requireProject(ctx, task.projectId, !recovery);
  requireTaskRevision(task, args.expectedUpdatedAt);
  if (args.operation === "archive" && task.status !== "done" && task.status !== "cancelled")
    throw new ConvexError("Only completed or cancelled tasks can be archived.");
  const field = recovery ? "deletedAt" : "archivedAt";
  const enabled = args.operation === "delete" || args.operation === "archive";
  return { task, user, field, enabled, unchanged: (task[field] != null) === enabled } as const;
}
async function applyChange(ctx: MutationCtx, change: Awaited<ReturnType<typeof prepareChange>>) {
  if (change.unchanged) return false;
  await writeTaskLifecycle(ctx, change.task, change.user._id, change.field, change.enabled);
  return true;
}
export async function writeTaskLifecycle(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  actorId: Id<"users">,
  field: "deletedAt" | "archivedAt",
  enabled: boolean,
  delivery: NonNullable<Parameters<typeof taskChanged>[4]> = "subscribers"
) {
  await ctx.db.patch(task._id, { [field]: enabled ? Date.now() : null });
  await taskChanged(ctx, task, actorId, undefined, delivery);
}
export const change = mutation({
  args: { taskId: v.id("tasks"), expectedUpdatedAt: v.number(), operation: lifecycleOperation },
  handler: async (ctx, args) => {
    await applyChange(ctx, await prepareChange(ctx, args));
  },
});
export const bulkAccess = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const { member, projectMember } = await requireProject(ctx, args.projectId);
    const writer = member.role !== "guest" && projectMember.role !== "guest";
    return { maxTasks: MAX_BULK_TASKS, canChange: writer, canDelete: writer && projectMember.role === "admin" };
  },
});
export const bulk = mutation({
  args: {
    projectId: v.id("projects"),
    operation: lifecycleOperation,
    tasks: v.array(v.object({ taskId: v.id("tasks"), expectedUpdatedAt: v.number() })),
  },
  handler: async (ctx, args) => {
    const access = await requireProject(ctx, args.projectId, true);
    if (args.operation === "delete" && access.projectMember.role !== "admin")
      throw new ConvexError("Only project administrators can move multiple tasks to Trash.");
    if (
      !args.tasks.length ||
      args.tasks.length > MAX_BULK_TASKS ||
      new Set(args.tasks.map((row) => row.taskId)).size !== args.tasks.length
    )
      throw new ConvexError(`Choose 1–${MAX_BULK_TASKS} distinct tasks.`);
    const changes = await Promise.all(
      args.tasks.map(async (row) => {
        const prepared = await prepareChange(ctx, { ...row, operation: args.operation });
        if (prepared.task.projectId !== args.projectId)
          throw new ConvexError("All selected tasks must belong to this project.");
        return prepared;
      })
    );
    const results = await Promise.all(changes.map((prepared) => applyChange(ctx, prepared)));
    return { selected: changes.length, changed: results.filter(Boolean).length };
  },
});
export const list = query({
  args: {
    projectId: v.id("projects"),
    view: v.union(v.literal("archived"), v.literal("deleted")),
    filters: v.optional(viewFilters),
    search: v.optional(v.string()),
    order: v.optional(taskOrder),
    includeSubtasks: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireProject(ctx, args.projectId);
    const { user, member, projectMember, project } = access;
    if (args.filters) validateShape(args.filters);
    const search = text(args.search ?? "", "Search", 255).toLowerCase();
    const ordering = taskOrdering[args.order ?? "createdAt"];
    const tasks = stream(ctx.db, schema).query("tasks");
    const source =
      args.order === "updatedAt"
        ? tasks.withIndex("by_project_updated", (q) => q.eq("projectId", project._id)).order("desc")
        : args.order === undefined || args.order === "createdAt"
          ? tasks.withIndex("by_project", (q) => q.eq("projectId", project._id)).order("desc")
          : tasks.withIndex(ordering.index, (q) => q.eq("workspaceId", project.workspaceId)).order(ordering.direction);
    return source
      .map(async (task) => {
        if (task.status === "triage" || task.projectId !== project._id || task.workspaceId !== project.workspaceId)
          return null;
        const eligible =
          args.view === "deleted"
            ? task.deletedAt != null && (task.createdBy === user._id || projectMember.role === "admin")
            : task.deletedAt == null &&
              task.archivedAt != null &&
              taskRoleCanRead(task, user._id, member.role, projectMember.role, !!project.guestViewAllFeatures);
        if (!eligible || !`${task.title} ${project.identifier}-${task.sequence}`.toLowerCase().includes(search))
          return null;
        if (args.filters && !(await matchesFilters(ctx, task, args.filters))) return null;
        if (
          args.includeSubtasks === false &&
          (await ctx.db
            .query("taskParents")
            .withIndex("by_child", (q) => q.eq("childId", task._id))
            .unique())
        )
          return null;
        return taskDetail(ctx, { ...task, status: task.status }, access);
      })
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const get = query({
  args: { taskId: v.string(), view: v.union(v.literal("archived"), v.literal("deleted")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const id = ctx.db.normalizeId("tasks", args.taskId);
    const task = id ? await ctx.db.get(id) : null;
    if (!task || task.status === "triage") return null;
    if (args.view === "deleted" ? task.deletedAt == null : task.deletedAt != null || task.archivedAt == null)
      return null;
    if (!(await taskCanRead(ctx, task, user._id, args.view === "deleted" ? "recovery" : "read"))) return null;
    return taskDetail(ctx, { ...task, status: task.status }, await requireProjectForUser(ctx, task.projectId, user));
  },
});
