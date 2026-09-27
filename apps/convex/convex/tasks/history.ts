import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import { requireIntakeTask, requireIntakeRevision } from "../intakes/access";
import { pageBudget } from "../commercial/validation";
import { requireTask } from "./access";
import { requireTaskRevision, taskChanged } from "./revision";
import { writeDescription } from "./description_content";
const scope = v.union(
  v.object({ kind: v.literal("task"), taskId: v.id("tasks") }),
  v.object({ kind: v.literal("intake"), taskId: v.id("tasks") })
);
async function access(ctx: QueryCtx, selection: { kind: "task" | "intake"; taskId: Id<"tasks"> }, write = false) {
  if (selection.kind === "intake") {
    const result = await requireIntakeTask(ctx, selection.taskId);
    checkGuest(result.access, result.task.createdBy);
    if (write && !result.canEdit)
      throw new ConvexError("Only the creator or an administrator can restore intake content.");
    return { task: result.task, permission: result.access, intake: result.intake };
  }
  const task = await requireTask(ctx, selection.taskId, write ? "active" : "read");
  const permission = await requireProject(ctx, task.projectId, write);
  checkGuest(permission, task.createdBy);
  return { task, permission, intake: null };
}
function guestCanRead(permission: Awaited<ReturnType<typeof requireProject>>, creator: Id<"users">) {
  return !(
    (permission.member.role === "guest" || permission.projectMember.role === "guest") &&
    !permission.project.guestViewAllFeatures &&
    permission.user._id !== creator
  );
}
function checkGuest(permission: Awaited<ReturnType<typeof requireProject>>, creator: Id<"users">) {
  if (!guestCanRead(permission, creator)) throw new ConvexError("You cannot read this task's description history.");
}
export const capabilities = query({
  args: { scope },
  handler: async (ctx, args) => {
    if (args.scope.kind === "intake") {
      const result = await requireIntakeTask(ctx, args.scope.taskId);
      const canRead = guestCanRead(result.access, result.task.createdBy);
      return {
        canRead,
        canRestore: canRead && result.canEdit,
        taskUpdatedAt: result.task.updatedAt,
        intakeUpdatedAt: result.intake.updatedAt,
      };
    }
    const task = await requireTask(ctx, args.scope.taskId, "read");
    const permission = await requireProject(ctx, task.projectId);
    const canRead = guestCanRead(permission, task.createdBy);
    return {
      canRead,
      canRestore:
        canRead &&
        task.archivedAt == null &&
        permission.member.role !== "guest" &&
        permission.projectMember.role !== "guest",
      taskUpdatedAt: task.updatedAt,
      intakeUpdatedAt: null,
    };
  },
});
export const list = query({
  args: { scope, paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { task } = await access(ctx, args.scope);
    const result = await ctx.db
      .query("taskDescriptionVersions")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    return {
      ...result,
      page: result.page.map(({ _id, _creationTime, actorId, lastSavedAt, revision }) => ({
        _id,
        createdAt: _creationTime,
        actorId,
        lastSavedAt,
        revision,
      })),
    };
  },
});
export const get = query({
  args: { scope, versionId: v.id("taskDescriptionVersions") },
  handler: async (ctx, args) => {
    const { task } = await access(ctx, args.scope);
    const version = await ctx.db.get(args.versionId);
    if (!version || version.taskId !== task._id) throw new ConvexError("Description version not found.");
    return version;
  },
});
export const restore = mutation({
  args: {
    scope,
    versionId: v.id("taskDescriptionVersions"),
    expectedVersionRevision: v.number(),
    expectedTaskUpdatedAt: v.number(),
    expectedIntakeUpdatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { task, permission, intake } = await access(ctx, args.scope, true);
    requireTaskRevision(task, args.expectedTaskUpdatedAt);
    if (intake) {
      if (args.expectedIntakeUpdatedAt === undefined) throw new ConvexError("Intake revision is required.");
      requireIntakeRevision(intake, task, args.expectedIntakeUpdatedAt, args.expectedTaskUpdatedAt);
    }
    const version = await ctx.db.get(args.versionId);
    if (!version || version.taskId !== task._id) throw new ConvexError("Description version not found.");
    if (version.revision !== args.expectedVersionRevision)
      throw new ConvexError("Description version changed. Preview it again before restoring.");
    await writeDescription(ctx, task, permission.user._id, version);
    await taskChanged(ctx, task, permission.user._id);
    if (intake) await ctx.db.patch(intake._id, { updatedAt: Math.max(Date.now(), intake.updatedAt + 1) });
  },
});
