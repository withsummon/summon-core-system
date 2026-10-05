import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { cyclePhase } from "./dates";
import { v, ConvexError, type Infer } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import schema from "../schema";
import { mutation, query } from "../_generated/server";
import { requireTask, taskIsActive, taskCanRead, taskDetail, taskOrdering } from "../tasks/access";
import { requireProject } from "../identity/access";
import { requireTaskRevision, taskChanged } from "../tasks/revision";
import { requireCycle, requireCycleRevision, requireOpenCycle } from "./access";
import { draftFields } from "../tasks/drafts/fields";
import { taskOrder, viewFilters } from "../tasks/schema";
import { matchesFilters, validateShape } from "../savedViews/filters";
export const assign = mutation({
  args: {
    cycleId: v.id("cycles"),
    taskId: v.id("tasks"),
    expectedTaskUpdatedAt: v.number(),
    expectedCycleUpdatedAt: v.number(),
  },
  handler: assignCycleTask,
});
export const remove = mutation({
  args: {
    cycleId: v.id("cycles"),
    taskId: v.id("tasks"),
    expectedTaskUpdatedAt: v.number(),
    expectedCycleUpdatedAt: v.number(),
  },
  handler: removeCycleTask,
});
export const current = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId, "read");
    await requireProject(ctx, task.projectId);
    return (await currentTaskCycle(ctx, task)).cycle;
  },
});
export const list = query({
  args: {
    cycleId: v.id("cycles"),
    filters: v.optional(viewFilters),
    order: v.optional(taskOrder),
    includeSubtasks: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireCycle(ctx, args.cycleId);
    const { cycle, user, member, projectMember } = access;
    const canDetach =
      member.role !== "guest" && projectMember.role !== "guest" && !cycle.archived && cyclePhase(cycle) !== "completed";
    if (
      !Number.isSafeInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    )
      throw new ConvexError("Choose 1–100 tasks per page.");
    if (args.filters) validateShape(args.filters);
    const source = stream(ctx.db, schema);
    const ordering = taskOrdering[args.order ?? "createdAt"];
    const tasks =
      args.order === undefined
        ? source
            .query("cycleTasks")
            .withIndex("by_cycle", (q) => q.eq("cycleId", cycle._id))
            .map((row) => ctx.db.get(row.taskId))
        : args.order === "createdAt"
          ? source
              .query("tasks")
              .withIndex("by_project", (q) => q.eq("projectId", cycle.projectId))
              .order("desc")
          : args.order === "updatedAt"
            ? source
                .query("tasks")
                .withIndex("by_project_updated", (q) => q.eq("projectId", cycle.projectId))
                .order("desc")
            : source
                .query("tasks")
                .withIndex(ordering.index, (q) => q.eq("workspaceId", cycle.workspaceId))
                .order(ordering.direction);
    return tasks
      .map(async (task) => {
        if (!task || task.projectId !== cycle.projectId || task.workspaceId !== cycle.workspaceId) return null;
        if (args.order !== undefined) {
          const membership = await ctx.db
            .query("cycleTasks")
            .withIndex("by_task", (q) => q.eq("taskId", task._id))
            .unique();
          if (membership?.cycleId !== cycle._id) return null;
        }
        const readable = taskIsActive(task) && (await taskCanRead(ctx, task, user._id));
        if (!readable && !canDetach) return null;
        if (args.filters && !(await matchesFilters(ctx, task, args.filters))) return null;
        if (
          args.includeSubtasks === false &&
          (await ctx.db
            .query("taskParents")
            .withIndex("by_child", (q) => q.eq("childId", task._id))
            .unique())
        )
          return null;
        return {
          taskId: task._id,
          updatedAt: task.updatedAt,
          task: readable ? await taskDetail(ctx, task, access) : null,
          unavailable: !taskIsActive(task),
        };
      })
      .paginate({ ...args.paginationOpts, maximumRowsRead: 100, maximumBytesRead: 1_048_576 });
  },
});

export async function readTaskCycle(ctx: QueryCtx, task: Doc<"tasks">) {
  const membership = await ctx.db
    .query("cycleTasks")
    .withIndex("by_task", (q) => q.eq("taskId", task._id))
    .unique();
  const cycle = membership ? await ctx.db.get(membership.cycleId) : null;
  if (membership && (!cycle || cycle.projectId !== task.projectId || cycle.workspaceId !== task.workspaceId))
    throw new ConvexError("Cycle reference not found in this project.");
  return { membership, cycle };
}
export async function currentTaskCycle(ctx: QueryCtx, task: Doc<"tasks">) {
  const { cycle } = await readTaskCycle(ctx, task);
  return {
    cycle: cycle && !cycle.deleted ? cycle : null,
    reference: cycle ? { cycleId: cycle._id, expectedCycleUpdatedAt: cycle.updatedAt } : null,
  };
}
export async function prepareCycleChange(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  previous: Infer<typeof draftFields.cycle>,
  next: Infer<typeof draftFields.cycle>
) {
  const { user } = await requireProject(ctx, task.projectId, true);
  const source = await readTaskCycle(ctx, task);
  const currentId = source.cycle?._id ?? null;
  if (currentId !== (previous?.cycleId ?? null))
    throw new ConvexError("Cycle membership changed. Reopen the work item before saving.");
  if (source.cycle && previous) requireCycleRevision(source.cycle, previous.expectedCycleUpdatedAt);
  let destination: Doc<"cycles"> | null = null;
  if (next) {
    destination = (await requireCycle(ctx, next.cycleId, true)).cycle;
    requireCycleRevision(destination, next.expectedCycleUpdatedAt);
    if (destination.projectId !== task.projectId) throw new ConvexError("Task belongs to another project.");
    requireOpenCycle(destination);
  }
  if (currentId === (destination?._id ?? null)) return null;
  if (source.cycle && !source.cycle.deleted) requireOpenCycle(source.cycle);
  return { task, user, source, destination };
}
export async function applyCycleChange(
  ctx: MutationCtx,
  prepared: NonNullable<Awaited<ReturnType<typeof prepareCycleChange>>>
): Promise<NonNullable<Doc<"taskEvents">["changes"]>> {
  const { task, source, destination } = prepared;
  if (destination) {
    if (source.membership) await ctx.db.patch(source.membership._id, { cycleId: destination._id });
    else await ctx.db.insert("cycleTasks", { cycleId: destination._id, taskId: task._id });
  } else if (source.membership) await ctx.db.delete(source.membership._id);
  return [
    {
      field: "cycle",
      before: source.cycle ? { id: source.cycle._id, name: source.cycle.name } : null,
      after: destination ? { id: destination._id, name: destination.name } : null,
    },
  ];
}
export async function assignCycleTask(
  ctx: MutationCtx,
  args: { cycleId: Id<"cycles">; taskId: Id<"tasks">; expectedTaskUpdatedAt: number; expectedCycleUpdatedAt: number }
) {
  const { cycle: destination } = await requireCycle(ctx, args.cycleId, true);
  requireOpenCycle(destination);
  requireCycleRevision(destination, args.expectedCycleUpdatedAt);
  const task = await requireTask(ctx, args.taskId);
  if (task.projectId !== destination.projectId) throw new ConvexError("Task belongs to another project.");
  const { cycle } = await readTaskCycle(ctx, task);
  if (cycle?._id === destination._id) return;
  requireTaskRevision(task, args.expectedTaskUpdatedAt);
  const prepared = await prepareCycleChange(
    ctx,
    task,
    cycle ? { cycleId: cycle._id, expectedCycleUpdatedAt: cycle.updatedAt } : null,
    { cycleId: args.cycleId, expectedCycleUpdatedAt: args.expectedCycleUpdatedAt }
  );
  if (prepared)
    await taskChanged(ctx, task, prepared.user._id, {
      kind: "updated",
      changes: await applyCycleChange(ctx, prepared),
    });
}
export async function removeCycleTask(
  ctx: MutationCtx,
  args: { cycleId: Id<"cycles">; taskId: Id<"tasks">; expectedTaskUpdatedAt: number; expectedCycleUpdatedAt: number }
) {
  const { cycle } = await requireCycle(ctx, args.cycleId, true);
  requireOpenCycle(cycle);
  requireCycleRevision(cycle, args.expectedCycleUpdatedAt);
  const task = await ctx.db.get(args.taskId);
  if (!task) throw new ConvexError("Task not found.");
  if (task.projectId !== cycle.projectId) throw new ConvexError("Task belongs to another project.");
  const { membership } = await readTaskCycle(ctx, task);
  if (!membership) return;
  requireTaskRevision(task, args.expectedTaskUpdatedAt);
  const prepared = await prepareCycleChange(
    ctx,
    task,
    { cycleId: args.cycleId, expectedCycleUpdatedAt: args.expectedCycleUpdatedAt },
    null
  );
  if (prepared)
    await taskChanged(ctx, task, prepared.user._id, {
      kind: "updated",
      changes: await applyCycleChange(ctx, prepared),
    });
}
