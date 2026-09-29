import { taskCanRead } from "./access";
import { taskIsActive } from "./access";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import schema from "../schema";
import { query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { Infer } from "convex/values";
import { requireWorkspace } from "../identity/access";
import { date, pageBudget, text } from "../commercial/validation";
import { priority } from "./schema";

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
function matchesDue(task: Doc<"tasks">, selected: Infer<typeof due>, today: string) {
  const completed = task.status === "done" || task.status === "cancelled";
  if (selected === "completed") return completed;
  if (selected === "all") return true;
  if (completed || !task.targetDate) return false;
  const target = Date.parse(task.targetDate);
  const start = Date.parse(today);
  const endOfWeek = start + (7 - (new Date(start).getUTCDay() || 7)) * 86400000;
  const matches = {
    today: target === start,
    overdue: target < start,
    week: target >= start && target <= endOfWeek,
    next7: target >= start && target <= start + 7 * 86400000,
  } satisfies Record<Exclude<Infer<typeof due>, "all" | "completed">, boolean>;
  return matches[selected];
}
export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    paginationOpts: paginationOptsValidator,
    scope,
    due,
    today: v.string(),
    priority: v.optional(priority),
    projectId: v.optional(v.id("projects")),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    date(args.today);
    const search = text(args.search ?? "", "Search", 255).toLowerCase();
    return stream(ctx.db, schema)
      .query("tasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .map(async (task) => {
        if (!taskIsActive(task) || !(await taskCanRead(ctx, task, user._id))) return null;
        const project = await ctx.db.get(task.projectId);
        if (!project) return null;
        const matches = [
          !args.projectId || task.projectId === args.projectId,
          !args.priority || task.priority === args.priority,
          matchesDue(task, args.due, args.today),
          `${task.title} ${project.name} ${project.identifier}-${task.sequence}`.toLowerCase().includes(search),
        ];
        if (!matches.every(Boolean)) return null;
        if (args.scope === "subscribed") {
          const subscription = await ctx.db
            .query("taskSubscriptions")
            .withIndex("by_task_user", (q) => q.eq("taskId", task._id).eq("userId", user._id))
            .unique();
          if (!subscription) return null;
        } else if (!matchesScope(task, args.scope, user._id)) return null;
        const state = task.stateId ? await ctx.db.get(task.stateId) : null;
        return {
          task,
          project: { id: project._id, name: project.name, identifier: project.identifier },
          state,
        };
      })
      .paginate(pageBudget(args.paginationOpts));
  },
});
