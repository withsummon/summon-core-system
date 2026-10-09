import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { Infer } from "convex/values";
import { z } from "zod";
import { internal } from "../_generated/api";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import schema from "../schema";
import { mutation, query, internalMutation } from "../_generated/server";
import { requireProject, requireProjectForUser, requireUser } from "../identity/access";
import { pageBudget, text } from "../commercial/validation";
import { taskOrder, viewFilters, taskDeletionPhase } from "./schema";
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
  if (
    field === "deletedAt" &&
    !enabled &&
    (await ctx.db
      .query("taskDeletionJobs")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .unique())
  )
    throw new ConvexError("API-retired tasks cannot be restored.");
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

// REST retirement owns a durable, irreversible intent. UI Trash retains its graph.
export async function beginTaskDeletion(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  actorId: Id<"users">,
  parentJob?: Doc<"taskDeletionJobs">
) {
  const existing = await ctx.db
    .query("taskDeletionJobs")
    .withIndex("by_task", (q) => q.eq("taskId", task._id))
    .unique();
  if (existing) {
    if (existing.workspaceId !== task.workspaceId || existing.deletedAt !== task.deletedAt)
      throw new Error("Task retirement ownership changed.");
    if (parentJob) {
      if (existing.parentJobId !== null && existing.parentJobId !== parentJob._id)
        throw new Error("Task retirement already belongs to another parent intent.");
      // Association does not replace the existing deadline, phase, revision or scheduled callback.
      if (existing.parentJobId === null) await ctx.db.patch(existing._id, { parentJobId: parentJob._id });
    }
    return;
  }
  const rootTaskId = parentJob?.rootTaskId ?? task._id;
  if (task.deletedAt === null)
    await writeTaskLifecycle(ctx, task, actorId, "deletedAt", true, parentJob ? "none" : "activity");
  const retired = await ctx.db.get(task._id);
  if (!retired || retired.deletedAt === null) throw new Error("Task retirement did not acquire a tombstone.");
  let purgeAt;
  if (parentJob) purgeAt = parentJob.purgeAt;
  else {
    const days = z
      .string()
      .trim()
      .regex(/^[+-]?\d+$/)
      .pipe(z.coerce.number().int().nonnegative().safe())
      .parse(process.env.HARD_DELETE_AFTER_DAYS ?? "60");
    purgeAt = retired.deletedAt + days * 24 * 60 * 60 * 1000;
  }
  if (!Number.isSafeInteger(purgeAt)) throw new Error("Task retention duration exceeds the supported date range.");
  const jobId = await ctx.db.insert("taskDeletionJobs", {
    taskId: task._id,
    rootTaskId,
    parentJobId: parentJob?._id ?? null,
    workspaceId: task.workspaceId,
    actorId,
    deletedAt: retired.deletedAt,
    purgeAt,
    phase: "children",
    cursor: null,
    revision: 0,
    purging: false,
    commentId: null,
    commentCursor: null,
    commentsDone: false,
  });
  await ctx.scheduler.runAfter(0, internal.tasks.lifecycle.retire, { jobId, expectedRevision: 0 });
}

const retirementBudget = { numItems: 20, maximumRowsRead: 20, maximumBytesRead: 1_048_576 };
async function retireRelations(ctx: MutationCtx, job: Doc<"taskDeletionJobs">, task: Doc<"tasks">) {
  const pagination = { ...retirementBudget, cursor: job.cursor };
  /* oxlint-disable no-await-in-loop */
  switch (job.phase) {
    case "children": {
      const rows = await ctx.db
        .query("taskParents")
        .withIndex("by_parent", (q) => q.eq("parentId", task._id))
        .paginate({ ...pagination, numItems: 1 });
      for (const edge of rows.page) {
        const child = await ctx.db.get(edge.childId);
        if (!child || child.workspaceId !== job.workspaceId) throw new Error("Retired child ownership changed.");
        await beginTaskDeletion(ctx, child, job.actorId, job);
        await ctx.db.delete(edge._id);
      }
      return rows;
    }
    case "parent": {
      const rows = await ctx.db
        .query("taskParents")
        .withIndex("by_child", (q) => q.eq("childId", task._id))
        .paginate(pagination);
      for (const edge of rows.page) {
        const parent = await ctx.db.get(edge.parentId);
        if (!parent || parent.workspaceId !== job.workspaceId) throw new Error("Retired parent ownership changed.");
        await ctx.db.delete(edge._id);
        await taskChanged(ctx, parent, job.actorId, undefined, "none");
      }
      return rows;
    }
    case "draftParents": {
      const rows = await ctx.db
        .query("taskDrafts")
        .withIndex("by_parent", (q) => q.eq("parent.taskId", task._id))
        .paginate(pagination);
      await Promise.all(
        rows.page.map(async (draft) => {
          if (draft.workspaceId !== job.workspaceId) throw new Error("Retired draft parent ownership changed.");
          await ctx.db.patch(draft._id, {
            parent: null,
            contentRevision: draft.contentRevision + 1,
            updatedAt: Math.max(Date.now(), draft.updatedAt + 1),
          });
        })
      );
      return rows;
    }
    case "relationsFrom":
    case "relationsTo": {
      const rows = await ctx.db
        .query("taskRelations")
        .withIndex(job.phase === "relationsFrom" ? "by_from" : "by_to", (q) =>
          job.phase === "relationsFrom" ? q.eq("fromId", task._id) : q.eq("toId", task._id)
        )
        .paginate({ ...pagination, numItems: 1 });
      for (const edge of rows.page) {
        const related = await ctx.db.get(edge.fromId === task._id ? edge.toId : edge.fromId);
        if (!related || related.workspaceId !== job.workspaceId || edge.workspaceId !== job.workspaceId)
          throw new Error("Retired relationship ownership changed.");
        await ctx.db.delete(edge._id);
        await taskChanged(ctx, related, job.actorId, undefined, "none");
      }
      return rows;
    }
    case "cycles": {
      const rows = await ctx.db
        .query("cycleTasks")
        .withIndex("by_task", (q) => q.eq("taskId", task._id))
        .paginate(pagination);
      await Promise.all(rows.page.map((row) => ctx.db.delete(row._id)));
      return rows;
    }
    case "modules": {
      const rows = await ctx.db
        .query("moduleTasks")
        .withIndex("by_task", (q) => q.eq("taskId", task._id))
        .paginate(pagination);
      // The canonical tombstone already removed every joined collection key.
      await Promise.all(rows.page.map((row) => ctx.db.delete(row._id)));
      return rows;
    }
    case "subscriptions": {
      const rows = await ctx.db
        .query("taskSubscriptions")
        .withIndex("by_task_user", (q) => q.eq("taskId", task._id))
        .paginate(pagination);
      await Promise.all(rows.page.map((row) => ctx.db.delete(row._id)));
      return rows;
    }
    default:
      throw new Error("Task retirement is not processing relationships.");
  }
}

/* oxlint-enable no-await-in-loop */
async function retireContent(ctx: MutationCtx, job: Doc<"taskDeletionJobs">, task: Doc<"tasks">) {
  const pagination = { ...retirementBudget, cursor: job.cursor };
  switch (job.phase) {
    case "intake": {
      const rows = await ctx.db
        .query("intakeTasks")
        .withIndex("by_task", (q) => q.eq("taskId", task._id))
        .paginate(pagination);
      await Promise.all(
        rows.page.map((row) =>
          job.purging
            ? ctx.db.delete(row._id)
            : ctx.db.patch(row._id, { deletedAt: row.deletedAt ?? job.deletedAt, removalTaskRevision: null })
        )
      );
      return rows;
    }
    case "reactions":
    case "votes":
    case "links": {
      const rows =
        job.phase === "reactions"
          ? await ctx.db
              .query("taskReactions")
              .withIndex("by_task_deleted", (q) => q.eq("taskId", task._id))
              .paginate(pagination)
          : job.phase === "votes"
            ? await ctx.db
                .query("taskVotes")
                .withIndex("by_task_actor_deleted", (q) => q.eq("taskId", task._id))
                .paginate(pagination)
            : await ctx.db
                .query("taskLinks")
                .withIndex("by_task_deleted", (q) => q.eq("taskId", task._id))
                .paginate(pagination);
      await Promise.all(
        rows.page.map((row) =>
          job.purging ? ctx.db.delete(row._id) : ctx.db.patch(row._id, { deletedAt: row.deletedAt ?? job.deletedAt })
        )
      );
      return rows;
    }
    case "assets":
    case "commentAssets":
    case "commentUploads": {
      let rows;
      if (job.phase === "commentAssets") {
        const commentId = job.commentId;
        if (!commentId) throw new Error("Retirement lost its comment frontier.");
        rows = await ctx.db
          .query("assets")
          .withIndex("by_comment", (q) => q.eq("commentId", commentId))
          .paginate(pagination);
      } else if (job.phase === "commentUploads") {
        rows = await ctx.db
          .query("assets")
          .withIndex("by_comment_upload_task", (q) => q.eq("commentUpload.taskId", task._id))
          .paginate(pagination);
      } else {
        rows = await ctx.db
          .query("assets")
          .withIndex("by_task_status", (q) => q.eq("taskId", task._id))
          .paginate(pagination);
      }
      await Promise.all(
        rows.page.map(async (asset) => {
          if (asset.workspaceId !== job.workspaceId) throw new Error("Retired asset ownership changed.");
          if (job.purging) {
            if (asset.storageId && (await ctx.db.system.get(asset.storageId)))
              await ctx.storage.delete(asset.storageId);
            await ctx.db.delete(asset._id);
          } else await ctx.db.patch(asset._id, { status: "deleted", expiresAt: job.purgeAt });
        })
      );
      return rows;
    }
    case "versions": {
      const rows = await ctx.db
        .query("taskDescriptionVersions")
        .withIndex("by_task", (q) => q.eq("taskId", task._id))
        .paginate(pagination);
      await Promise.all(rows.page.map((row) => ctx.db.delete(row._id)));
      return rows;
    }
    case "descriptions": {
      const rows = await ctx.db
        .query("taskDescriptions")
        .withIndex("by_task", (q) => q.eq("taskId", task._id))
        .paginate(pagination);
      await Promise.all(rows.page.map((row) => ctx.db.delete(row._id)));
      return rows;
    }
    default:
      throw new Error("Task retirement is not processing content.");
  }
}

export const retire = internalMutation({
  args: { jobId: v.id("taskDeletionJobs"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.phase === "purged" || job.revision !== args.expectedRevision) return;
    const task = await ctx.db.get(job.taskId);
    if (!task || task.workspaceId !== job.workspaceId || task.deletedAt !== job.deletedAt)
      throw new Error("Task retirement ownership changed.");
    let update: Partial<Doc<"taskDeletionJobs">>;
    if (job.phase === "waiting") {
      // The indexed job relation survives other owners unlinking the original Task parent edge.
      const [before, after] = await Promise.all([
        ctx.db
          .query("taskDeletionJobs")
          .withIndex("by_parent_phase", (q) => q.eq("parentJobId", job._id).lt("phase", "purged"))
          .first(),
        ctx.db
          .query("taskDeletionJobs")
          .withIndex("by_parent_phase", (q) => q.eq("parentJobId", job._id).gt("phase", "purged"))
          .first(),
      ]);
      update = Date.now() < job.purgeAt || before || after ? {} : { phase: "intake", cursor: null, purging: true };
    } else if (job.phase === "comments") {
      const rows = await ctx.db
        .query("taskComments")
        .withIndex("by_task", (q) => q.eq("taskId", task._id))
        .paginate({ ...retirementBudget, numItems: 1, cursor: job.cursor });
      const comment = rows.page[0];
      if (comment) {
        if (!job.purging) await ctx.db.patch(comment._id, { deletedAt: comment.deletedAt ?? job.deletedAt });
        update = {
          phase: "commentReactions",
          cursor: null,
          commentId: comment._id,
          commentCursor: rows.continueCursor,
          commentsDone: rows.isDone,
        };
      } else update = { phase: rows.isDone ? "reactions" : "comments", cursor: rows.continueCursor };
    } else if (job.phase === "commentReactions") {
      const commentId = job.commentId;
      if (!commentId) throw new Error("Retirement lost its comment frontier.");
      const rows = await ctx.db
        .query("taskCommentReactions")
        .withIndex("by_comment_deleted", (q) => q.eq("commentId", commentId))
        .paginate({ ...retirementBudget, cursor: job.cursor });
      await Promise.all(
        rows.page.map((row) =>
          job.purging ? ctx.db.delete(row._id) : ctx.db.patch(row._id, { deletedAt: row.deletedAt ?? job.deletedAt })
        )
      );
      if (rows.isDone) {
        update = { phase: "commentAssets", cursor: null };
      } else update = { cursor: rows.continueCursor };
    } else if (job.phase === "commentAssets") {
      if (!job.commentId) throw new Error("Retirement lost its comment frontier.");
      const rows = await retireContent(ctx, job, task);
      if (rows.isDone) {
        if (job.purging) await ctx.db.delete(job.commentId);
        update = {
          phase: job.commentsDone ? "reactions" : "comments",
          cursor: job.commentsDone ? null : job.commentCursor,
          commentId: null,
          commentCursor: null,
          commentsDone: false,
        };
      } else update = { cursor: rows.continueCursor };
    } else {
      const rows = [
        "children",
        "parent",
        "draftParents",
        "relationsFrom",
        "relationsTo",
        "cycles",
        "modules",
        "subscriptions",
      ].includes(job.phase)
        ? await retireRelations(ctx, job, task)
        : await retireContent(ctx, job, task);
      const phase =
        job.phase === "intake"
          ? "comments"
          : job.phase === "commentUploads"
            ? job.purging
              ? "versions"
              : "waiting"
            : job.phase === "descriptions"
              ? "purged"
              : taskDeletionPhase.members[taskDeletionPhase.members.findIndex(({ value }) => value === job.phase) + 1]
                  .value;
      update = { phase: rows.isDone ? phase : job.phase, cursor: rows.isDone ? null : rows.continueCursor };
    }
    const revision = job.revision + 1;
    await ctx.db.patch(job._id, { ...update, revision });
    if (update.phase === "purged") await ctx.db.delete(task._id);
    else {
      const remaining = job.purgeAt - Date.now();
      await ctx.scheduler.runAfter(
        // Native scheduling permits at most five years ahead; wake annually without shortening retention.
        (update.phase ?? job.phase) === "waiting"
          ? remaining > 0
            ? Math.min(365 * 24 * 60 * 60 * 1000, remaining)
            : 60_000
          : 0,
        internal.tasks.lifecycle.retire,
        { jobId: job._id, expectedRevision: revision }
      );
    }
  },
});
