import { taskStateDeletedAt, taskStateIsTriage } from "../tasks/schema";
import { compareValues, ConvexError, v, type Infer } from "convex/values";
import { query, mutation, internalMutation, type QueryCtx, type MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { requireProject } from "../identity/access";
import { requireNetworkScope } from "./network_access";
import { canAdministerProject } from "./administration";
import { inactivityMonths, inactivityPolicy } from "./schema";
import { readTaskCycle } from "../cycles/tasks";
import { cyclePhase } from "../cycles/dates";
import { readTaskModules } from "../modules/tasks";
import { taskIsActive } from "../tasks/access";
import { taskChanged } from "../tasks/revision";
import { applyPropertyUpdate } from "../tasks/property_updates";

async function policy(ctx: QueryCtx, projectId: Id<"projects">) {
  return ctx.db
    .query("projectInactivityPolicies")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .unique();
}
export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const { project, member, user } = await requireProject(ctx, args.projectId);
    const current = await policy(ctx, project._id);
    const states = await ctx.db
      .query("taskStates")
      .withIndex("by_project_order", (q) => q.eq("projectId", project._id))
      .take(101);
    if (states.length > 100) throw new ConvexError("A project supports up to 100 task states.");
    return {
      archiveMonths: current?.archiveMonths ?? 0,
      close: current?.close ?? null,
      revision: current?.revision ?? null,
      canConfigure: await canAdministerProject(ctx, project, user._id, member.role),
      months: inactivityMonths.members.map((entry) => entry.value),
      cancelledStates: states.filter(
        (state) =>
          taskStateDeletedAt(state.deletedAt) === null &&
          !taskStateIsTriage(state.isTriage) &&
          state.status === "cancelled"
      ),
    };
  },
});
export const save = mutation({
  args: {
    projectId: v.id("projects"),
    expectedRevision: v.union(v.number(), v.null()),
    changes: inactivityPolicy.partial(),
  },
  handler: async (ctx, args) => {
    const { project, user, member } = await requireNetworkScope(ctx, args.projectId);
    if (!(await canAdministerProject(ctx, project, user._id, member.role)))
      throw new ConvexError("Only workspace or project administrators can configure inactivity automations.");
    const current = await policy(ctx, project._id);
    const currentRevision = current?.revision ?? null;
    if (
      (args.expectedRevision !== null && !Number.isSafeInteger(args.expectedRevision)) ||
      args.expectedRevision !== currentRevision
    )
      throw new ConvexError("Inactivity automations changed. Reopen their latest settings.");
    const previous = { archiveMonths: current?.archiveMonths ?? 0, close: current?.close ?? null };
    const next = { ...previous, ...args.changes };
    return writeInactivityPolicy(
      ctx,
      { projectId: project._id, workspaceId: project.workspaceId, configuredBy: user._id },
      next,
      current
    );
  },
});
export async function writeInactivityPolicy(
  ctx: MutationCtx,
  scope: Pick<Doc<"projectInactivityPolicies">, "projectId" | "workspaceId" | "configuredBy">,
  next: Infer<typeof inactivityPolicy>,
  current: Doc<"projectInactivityPolicies"> | null
) {
  if (next.close) {
    const state = await ctx.db.get(next.close.stateId);
    if (
      state?.projectId !== scope.projectId ||
      state.workspaceId !== scope.workspaceId ||
      taskStateDeletedAt(state.deletedAt) !== null ||
      taskStateIsTriage(state.isTriage) ||
      state.status !== "cancelled"
    )
      throw new ConvexError("Choose a cancellation state in this project.");
  }
  if (compareValues({ archiveMonths: current?.archiveMonths ?? 0, close: current?.close ?? null }, next) === 0)
    return { revision: current?.revision ?? null };
  const revision = current ? current.revision + 1 : 0;
  const data = { ...next, configuredBy: scope.configuredBy, revision };
  if (current) await ctx.db.patch(current._id, data);
  else
    await ctx.db.insert("projectInactivityPolicies", {
      ...data,
      projectId: scope.projectId,
      workspaceId: scope.workspaceId,
    });
  return { revision };
}

async function endedMemberships(ctx: QueryCtx, task: Doc<"tasks">, asOf: number) {
  const [cycle, modules] = await Promise.all([readTaskCycle(ctx, task), readTaskModules(ctx, task)]);
  if (cycle.cycle && cyclePhase(cycle.cycle, asOf) !== "completed") return false;
  const day = new Date(asOf).toISOString().slice(0, 10);
  // The inherited joined query is existential: any ended module qualifies, even with another future module.
  if (modules.length && !modules.some(({ module }) => module.targetDate !== null && module.targetDate < day))
    return false;
  const intake = await ctx.db
    .query("intakeTasks")
    .withIndex("by_task", (q) => q.eq("taskId", task._id))
    .unique();
  return (
    !intake ||
    (intake.projectId === task.projectId &&
      (intake.status === "accepted" || intake.status === "rejected" || intake.status === "duplicate"))
  );
}
export const sweep = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("projectInactivityPolicies").paginate({
      cursor: args.cursor,
      numItems: 25,
      maximumRowsRead: 25,
      maximumBytesRead: 1048576,
    });
    const asOf = Date.now();
    await Promise.all(
      page.page.map(async (current) => {
        if (current.archiveMonths || current.close)
          await ctx.scheduler.runAfter(0, internal.projects.inactivity.run, {
            policyId: current._id,
            expectedRevision: current.revision,
            phase: "archive",
            cursor: null,
            asOf,
          });
      })
    );
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.projects.inactivity.sweep, { cursor: page.continueCursor });
    return { processed: page.page.length, isDone: page.isDone };
  },
});
export const run = internalMutation({
  args: {
    policyId: v.id("projectInactivityPolicies"),
    expectedRevision: v.number(),
    phase: v.union(v.literal("archive"), v.literal("close")),
    cursor: v.union(v.string(), v.null()),
    asOf: v.number(),
  },
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.policyId);
    if (!current || current.revision !== args.expectedRevision) return { changed: 0, isDone: true };
    const project = await ctx.db.get(current.projectId);
    const workspace = await ctx.db.get(current.workspaceId);
    if (
      !project ||
      project.workspaceId !== current.workspaceId ||
      project.archived ||
      project.deletedAt != null ||
      !workspace ||
      workspace.deletedAt != null
    )
      return { changed: 0, isDone: true };
    const months = args.phase === "archive" ? current.archiveMonths : (current.close?.months ?? 0);
    if (!months) {
      if (args.phase === "archive" && current.close)
        await ctx.scheduler.runAfter(0, internal.projects.inactivity.run, { ...args, phase: "close", cursor: null });
      return { changed: 0, isDone: true };
    }
    const actor = await ctx.db.get(current.configuredBy);
    if (!actor) throw new ConvexError("The inactivity policy's activity author is unavailable.");
    const state = current.close ? await ctx.db.get(current.close.stateId) : null;
    const page = await ctx.db
      .query("tasks")
      .withIndex("by_project_updated", (q) =>
        q.eq("projectId", project._id).lte("updatedAt", args.asOf - months * 30 * 86400000)
      )
      .paginate({ cursor: args.cursor, numItems: 20, maximumRowsRead: 20, maximumBytesRead: 1048576 });
    const changes = await Promise.all(
      page.page.map(async (task) => {
        if (!taskIsActive(task) || task.workspaceId !== workspace._id) return false;
        const terminal = task.status === "done" || task.status === "cancelled";
        if ((args.phase === "archive") !== terminal || !(await endedMemberships(ctx, task, args.asOf))) return false;
        if (args.phase === "archive") {
          await ctx.db.patch(task._id, { archivedAt: Date.now() });
          await taskChanged(ctx, task, actor._id, { kind: "archived", automation: true });
        } else {
          if (
            state?.projectId !== project._id ||
            state.workspaceId !== workspace._id ||
            taskStateDeletedAt(state.deletedAt) !== null ||
            taskStateIsTriage(state.isTriage) ||
            state.status !== "cancelled"
          )
            throw new ConvexError("The inactivity policy's cancellation state is unavailable.");
          await applyPropertyUpdate(
            ctx,
            { task, user: actor, data: { stateId: state._id }, status: state.status },
            undefined,
            { kind: "status_changed", automation: true }
          );
        }
        return true;
      })
    );
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.projects.inactivity.run, { ...args, cursor: page.continueCursor });
    else if (args.phase === "archive" && current.close)
      await ctx.scheduler.runAfter(0, internal.projects.inactivity.run, { ...args, phase: "close", cursor: null });
    return { changed: changes.filter(Boolean).length, isDone: page.isDone };
  },
});
