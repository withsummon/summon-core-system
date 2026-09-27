import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { projectReader, projectSummary } from "../savedViews/scope";
import { requireTask, taskCanRead, readableTasks, taskIsActive } from "./access";
import { requireTaskRevision, taskChanged } from "./revision";

export async function requireParent(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  parentId: Id<"tasks">,
  expectedUpdatedAt: number
) {
  const parent = await requireTask(ctx, parentId);
  await requireProject(ctx, parent.projectId, true);
  const project = await ctx.db.get(projectId);
  if (!project || parent.workspaceId !== project.workspaceId)
    throw new ConvexError("Parent task must belong to the same workspace.");
  requireTaskRevision(parent, expectedUpdatedAt);
  return parent;
}
export const parent = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const task = await requireTask(ctx, taskId, "read");
    const { user, member, projectMember } = await requireProject(ctx, task.projectId);
    const link = await ctx.db
      .query("taskParents")
      .withIndex("by_child", (q) => q.eq("childId", taskId))
      .unique();
    const parentTask = link ? await ctx.db.get(link.parentId) : null;
    const access = parentTask ? await projectReader(ctx, task.workspaceId, user._id)(parentTask.projectId) : null;
    const visible = parentTask && access && (await taskCanRead(ctx, parentTask, user._id));
    return {
      task: visible ? parentTask : null,
      project: visible ? projectSummary(access.project) : null,
      hasParent: link !== null,
      canUnlink:
        taskIsActive(task) &&
        member.role !== "guest" &&
        projectMember.role !== "guest" &&
        access !== null &&
        access.member.role !== "guest",
    };
  },
});
export const children = query({
  args: { taskId: v.id("tasks"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId, "read");
    const { user, member, projectMember } = await requireProject(ctx, task.projectId);
    const result = await ctx.db
      .query("taskParents")
      .withIndex("by_parent", (q) => q.eq("parentId", task._id))
      .paginate(pageBudget(args.paginationOpts));
    const childTasks = await Promise.all(result.page.map((link) => ctx.db.get(link.childId)));
    const readable = await readableTasks(
      ctx,
      childTasks.filter((child) => child !== null).filter((child) => child.workspaceId === task.workspaceId),
      user._id
    );
    const readProject = projectReader(ctx, task.workspaceId, user._id);
    const rows = await Promise.all(
      // Preserve database documents while adding authorized query-only projections.
      // oxlint-disable-next-line no-map-spread
      readable.map(async (child) => {
        const access = await readProject(child.projectId);
        return access
          ? {
              ...child,
              project: projectSummary(access.project),
              canUnlink:
                taskIsActive(child) &&
                taskIsActive(task) &&
                member.role !== "guest" &&
                projectMember.role !== "guest" &&
                access.member.role !== "guest",
            }
          : null;
      })
    );
    return { ...result, page: rows.filter((row) => row !== null) };
  },
});
export async function checkAncestors(ctx: MutationCtx, childId: Id<"tasks">, parentTask: Doc<"tasks">) {
  let ancestor: Id<"tasks"> | null = parentTask._id;
  for (let depth = 0; ancestor; depth++) {
    if (ancestor === childId) throw new ConvexError("A task cannot be its own ancestor.");
    if (depth >= 100) throw new ConvexError("Parent hierarchy exceeds 100 levels.");
    // The next ancestor depends on the preceding indexed lookup.
    // oxlint-disable-next-line no-await-in-loop
    const link = await ctx.db
      .query("taskParents")
      .withIndex("by_child", (q) => q.eq("childId", ancestor!))
      .unique();
    ancestor = link?.parentId ?? null;
  }
}
export const setParent = mutation({
  args: {
    taskId: v.id("tasks"),
    expectedUpdatedAt: v.number(),
    parent: v.union(v.object({ taskId: v.id("tasks"), expectedUpdatedAt: v.number() }), v.null()),
  },
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId);
    const { user } = await requireProject(ctx, task.projectId, true);
    requireTaskRevision(task, args.expectedUpdatedAt);
    const next = args.parent
      ? await requireParent(ctx, task.projectId, args.parent.taskId, args.parent.expectedUpdatedAt)
      : null;
    if (next) await checkAncestors(ctx, task._id, next);
    const existing = await ctx.db
      .query("taskParents")
      .withIndex("by_child", (q) => q.eq("childId", task._id))
      .unique();
    if ((existing?.parentId ?? null) === (next?._id ?? null)) return;
    const previous = existing ? await ctx.db.get(existing.parentId) : null;
    if (existing) {
      if (!previous || previous.workspaceId !== task.workspaceId)
        throw new ConvexError("Previous parent task not found in this workspace.");
      await requireProject(ctx, previous.projectId, true);
      await ctx.db.delete(existing._id);
    }
    if (next)
      await ctx.db.insert("taskParents", {
        projectId: task.projectId,
        childId: task._id,
        parentId: next._id,
      });
    await taskChanged(ctx, task, user._id);
    if (next) await taskChanged(ctx, next, user._id);
    if (previous && previous._id !== next?._id) await taskChanged(ctx, previous, user._id);
  },
});
