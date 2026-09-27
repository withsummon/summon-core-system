import { taskIsActive } from "./access";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { Infer } from "convex/values";
import { requireWorkspace } from "../identity/access";
import { date, pageBudget, text } from "../commercial/validation";
import { priority } from "./schema";

const scope = v.union(v.literal("all"), v.literal("mine"), v.literal("team"), v.literal("created"));
const due = v.union(
  v.literal("all"),
  v.literal("today"),
  v.literal("overdue"),
  v.literal("week"),
  v.literal("next7"),
  v.literal("completed")
);
function matchesScope(task: Doc<"tasks">, selected: Infer<typeof scope>, userId: Id<"users">) {
  const assignees = task.assigneeIds;
  const matches = {
    all: true,
    mine: assignees.includes(userId),
    team: assignees.length > 0,
    created: task.createdBy === userId,
  } satisfies Record<Infer<typeof scope>, boolean>;
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
    const result = await ctx.db
      .query("tasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    // The cursor covers scanned rows; consumers must continue through empty filtered pages. Never report page size as a global total.
    const visible = await Promise.all(
      result.page.map(async (task) => {
        if (!taskIsActive(task)) return null;
        const project = await ctx.db.get(task.projectId);
        if (!project || project.archived) return null;
        const membership = await ctx.db
          .query("projectMembers")
          .withIndex("by_project_user", (q) => q.eq("projectId", project._id).eq("userId", user._id))
          .unique();
        if (!membership?.active) return null;
        const matches = [
          !args.projectId || task.projectId === args.projectId,
          !args.priority || task.priority === args.priority,
          matchesScope(task, args.scope, user._id),
          matchesDue(task, args.due, args.today),
          `${task.title} ${project.name} ${project.identifier}-${task.sequence}`.toLowerCase().includes(search),
        ];
        if (!matches.every(Boolean)) return null;
        const state = task.stateId ? await ctx.db.get(task.stateId) : null;
        return {
          task,
          project: { id: project._id, name: project.name, identifier: project.identifier },
          state,
        };
      })
    );
    return { ...result, page: visible.filter((task) => task !== null) };
  },
});
