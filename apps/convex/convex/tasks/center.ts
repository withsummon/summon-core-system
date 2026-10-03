import { taskAssignee, taskDetail, taskIsActive, taskRoleCanRead } from "./access";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import schema from "../schema";
import { query, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { Infer } from "convex/values";
import { requireWorkspace } from "../identity/access";
import { date, pageBudget, text } from "../commercial/validation";
import { priority } from "./schema";
import { projectReader, projectSummary } from "../savedViews/scope";

const scope = v.union(
  v.literal("all"),
  v.literal("mine"),
  v.literal("team"),
  v.literal("created"),
  v.literal("subscribed")
);
const due = v.union(
  v.literal("all"),
  v.literal("today"),
  v.literal("overdue"),
  v.literal("week"),
  v.literal("next7"),
  v.literal("completed")
);
function matchesScope(task: Doc<"tasks">, selected: Exclude<Infer<typeof scope>, "subscribed">, userId: Id<"users">) {
  const assignees = task.assigneeIds;
  const matches = {
    all: true,
    mine: assignees.includes(userId),
    team: assignees.length > 0,
    created: task.createdBy === userId,
  } satisfies Record<Exclude<Infer<typeof scope>, "subscribed">, boolean>;
  return matches[selected];
}
function dueEligibility(task: Doc<"tasks">, today: string) {
  const completed = task.completedAt !== null || task.status === "done" || task.status === "cancelled";
  const target = task.targetDate === null ? null : Date.parse(task.targetDate);
  const start = Date.parse(today);
  const endOfWeek = start + (7 - (new Date(start).getUTCDay() || 7)) * 86400000;
  const pending = !completed && target !== null;
  return {
    all: true,
    today: pending && target === start,
    overdue: pending && target < start,
    week: pending && target >= start && target <= endOfWeek,
    next7: pending && target >= start && target <= start + 7 * 86400000,
    completed,
  } satisfies Record<Infer<typeof due>, boolean>;
}
const centerArgs = v.object({
  workspaceId: v.id("workspaces"),
  paginationOpts: paginationOptsValidator,
  scope,
  today: v.string(),
});
async function scopedTasks(ctx: QueryCtx, args: Infer<typeof centerArgs> & { attention?: boolean }) {
  const workspaceAccess = await requireWorkspace(ctx, args.workspaceId);
  const { user, member } = workspaceAccess;
  date(args.today);
  const read = projectReader(ctx, args.workspaceId, user._id);
  const tasks = stream(ctx.db, schema).query("tasks");
  const ordered = args.attention
    ? tasks.withIndex("by_workspace_target", (q) => q.eq("workspaceId", args.workspaceId)).order("asc")
    : tasks.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).order("desc");
  return ordered.map(async (task) => {
    if (!taskIsActive(task)) return null;
    if (args.scope === "subscribed") {
      if (
        !(await ctx.db
          .query("taskSubscriptions")
          .withIndex("by_task_user", (q) => q.eq("taskId", task._id).eq("userId", user._id))
          .unique())
      )
        return null;
    } else if (!matchesScope(task, args.scope, user._id)) return null;
    const access = await read(task.projectId);
    if (
      !access ||
      !taskRoleCanRead(task, user._id, member.role, access.member.role, !!access.project.guestViewAllFeatures)
    )
      return null;
    return {
      task,
      project: access.project,
      access: { ...workspaceAccess, project: access.project, projectMember: access.member },
    };
  });
}
export const list = query({
  args: {
    ...centerArgs.fields,
    due,
    priority: v.optional(priority),
    projectId: v.optional(v.id("projects")),
    search: v.optional(v.string()),
    attention: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const search = text(args.search ?? "", "Search", 255).toLowerCase();
    return (await scopedTasks(ctx, args))
      .map(async ({ task, project, access }) => {
        const matches = [
          !args.projectId || task.projectId === args.projectId,
          !args.attention ||
            (!dueEligibility(task, args.today).completed &&
              (dueEligibility(task, args.today).today || dueEligibility(task, args.today).overdue)),
          !args.priority || task.priority === args.priority,
          dueEligibility(task, args.today)[args.due],
          `${task.title} ${project.name} ${project.identifier}-${task.sequence}`.toLowerCase().includes(search),
        ];
        if (!matches.every(Boolean)) return null;
        const state = task.stateId ? await ctx.db.get(task.stateId) : null;
        return {
          task: await taskDetail(ctx, task, access),
          project: projectSummary(project),
          state,
        };
      })
      .paginate(pageBudget(args.paginationOpts));
  },
});

// Dashboard totals are exact only after the consumer exhausts this scoped stream.
// Table search/project/priority/due selections do not change this cohort.
export const summary = query({
  args: centerArgs.fields,
  handler: async (ctx, args) =>
    (await scopedTasks(ctx, args))
      .map(async ({ task, project }) => ({
        taskId: task._id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        targetDate: task.targetDate,
        completedAt: task.completedAt,
        due: dueEligibility(task, args.today),
        project: projectSummary(project),
        assignee: task.assigneeIds[0] ? await taskAssignee(ctx, project, task.assigneeIds[0]) : null,
      }))
      .paginate(pageBudget(args.paginationOpts)),
});
