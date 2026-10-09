import { requireTaskLabelAdopted, taskTables, taskExpression } from "./schema";
import { internal } from "../_generated/api";
import { requireProjectForUser } from "../identity/access";
import { requireAccountUser } from "../identity/session";
import { taskChanged } from "./revision";
import { compareValues, ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { pageBudget } from "../commercial/validation";
import { internalMutation, mutation, query, type MutationCtx } from "../_generated/server";
import { requireLabelManagement } from "./label_access";
import type { Doc, Id } from "../_generated/dataModel";
function removeLabelFilter(
  filters: Doc<"savedViews">["filters"],
  labelId: Id<"taskLabels">
): Doc<"savedViews">["filters"] {
  if (filters === null) return null;
  if (filters.type === "condition") {
    if (filters.property !== "labelId") return filters;
    if (filters.operator === "exact") return filters.value === labelId ? null : filters;
    const value = filters.value.filter((id) => id !== labelId);
    return value.length === filters.value.length ? filters : value.length ? { ...filters, value } : null;
  }
  const children = filters.children.map((child) => removeLabelFilter(child, labelId));
  if (children.every((child, index) => child === filters.children[index])) return filters;
  const retained = children.filter((child) => child !== null);
  return retained.length === 0
    ? null
    : retained.length === 1
      ? retained[0]
      : taskExpression.parse({ ...filters, children: retained });
}
export const list = query({
  args: { projectId: v.id("projects"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireLabelManagement(ctx, args.projectId);
    const result = await ctx.db
      .query("labelRemovalJobs")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    // Descendant identity/work and migration history never cross this public boundary.
    return {
      ...result,
      page: result.page.map(({ _id, name, phase, changed, started, status }) => ({
        _id,
        name,
        phase,
        changed,
        started,
        status,
      })),
    };
  },
});
export const begin = mutation({
  args: { labelId: v.id("taskLabels"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const label = await ctx.db.get(args.labelId);
    if (!label || label.projectId === null) throw new ConvexError("Label not found.");
    const { user } = await requireLabelManagement(ctx, label.projectId);
    if (label.revision !== args.expectedRevision) throw new ConvexError("Label changed. Reopen its latest settings.");
    return beginTaskLabelRemoval(ctx, label, user);
  },
});
export const cancel = mutation({
  args: { jobId: v.id("labelRemovalJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new ConvexError("Removal not found.");
    const { user } = await requireLabelManagement(ctx, job.projectId);
    if (job.status !== "running") return;
    if (job.started) throw new ConvexError("Removal has already started. Continue it to completion.");
    if (
      !job.rootLabelId ||
      job.rootRevision === undefined ||
      job.labelIds !== undefined ||
      job.documentLabelIndex !== undefined ||
      job.cursor !== undefined
    )
      throw new ConvexError("Legacy removal must be reconciled before continuing.");
    const root = await ctx.db.get(job.rootLabelId);
    if (!root) throw new ConvexError("Label changed. Continue removal to completion.");
    requireTaskLabelAdopted(root);
    if (!root.retiring || root.revision !== job.rootRevision)
      throw new ConvexError("Label changed. Continue removal to completion.");
    const work = await ctx.db
      .query("labelRemovalWork")
      .withIndex("by_job_label", (q) => q.eq("jobId", job._id).eq("labelId", root._id))
      .unique();
    if (!work || work.phase !== "discover" || work.cursor !== null)
      throw new ConvexError("Removal has already started. Continue it to completion.");
    await ctx.db.patch(root._id, {
      retiring: false,
      revision: root.revision + 1,
      updatedAt: Date.now(),
      updatedBy: user._id,
    });
    await ctx.db.delete(work._id);
    await ctx.db.patch(job._id, { status: "cancelled" });
  },
});
export const step = mutation({
  args: { jobId: v.id("labelRemovalJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new ConvexError("Removal not found.");
    const { user } = await requireLabelManagement(ctx, job.projectId);
    return stepTaskLabelRemoval(ctx, job, user);
  },
});
export async function beginTaskLabelRemoval(ctx: MutationCtx, label: Doc<"taskLabels">, user: Doc<"users">) {
  requireTaskLabelAdopted(label);
  if (label.projectId === null) throw new ConvexError("Choose a project label to remove.");
  if (label.retiring) throw new ConvexError("Label removal is already in progress.");
  const rootRevision = label.revision + 1;
  await ctx.db.patch(label._id, { retiring: true, updatedBy: user._id, updatedAt: Date.now(), revision: rootRevision });
  const jobId = await ctx.db.insert("labelRemovalJobs", {
    workspaceId: label.workspaceId,
    projectId: label.projectId,
    rootLabelId: label._id,
    rootRevision,
    name: label.name,
    phase: "discover",
    changed: 0,
    started: false,
    status: "running",
  });
  await ctx.db.insert("labelRemovalWork", { jobId, labelId: label._id, phase: "discover", cursor: null });
  return jobId;
}
// One retained label owns each bounded reference cohort, including foreign/global descendants.
async function stepLabelReferences(
  ctx: MutationCtx,
  work: Doc<"labelRemovalWork">,
  label: Doc<"taskLabels">,
  user: Doc<"users">
) {
  let changed = 0;
  const opts = {
    cursor: work.cursor,
    numItems: work.phase === "tasks" ? 20 : 50,
    maximumRowsRead: work.phase === "tasks" ? 20 : 50,
    maximumBytesRead: 1_048_576,
  };
  const projectId = label.projectId;
  if (work.phase === "tasks") {
    if (projectId === null) return { changed, isDone: true, continueCursor: null };
    const page = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .paginate(opts);
    await Promise.all(
      page.page.map(async (row) => {
        const labelIds = row.labelIds.filter((id) => id !== label._id);
        if (labelIds.length !== row.labelIds.length) {
          await ctx.db.patch(row._id, { labelIds });
          await taskChanged(ctx, row, user._id);
          changed++;
        }
      })
    );
    return { changed, isDone: page.isDone, continueCursor: page.continueCursor };
  }
  if (work.phase === "drafts") {
    if (projectId === null) return { changed, isDone: true, continueCursor: null };
    const page = await ctx.db
      .query("taskDrafts")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .paginate(opts);
    await Promise.all(
      page.page.map(async (row) => {
        const labelIds = row.properties.labelIds.filter((id) => id !== label._id);
        if (!row.publishedTaskId && labelIds.length !== row.properties.labelIds.length) {
          await ctx.db.patch(row._id, {
            properties: { ...row.properties, labelIds },
            updatedAt: Math.max(Date.now(), row.updatedAt + 1),
            contentRevision: row.contentRevision + 1,
          });
          changed++;
        }
      })
    );
    return { changed, isDone: page.isDone, continueCursor: page.continueCursor };
  }
  if (work.phase === "documents") {
    const page = await ctx.db
      .query("documentLabels")
      .withIndex("by_label", (q) => q.eq("labelId", label._id))
      .paginate(opts);
    await Promise.all(
      page.page.map(async (row) => {
        await ctx.db.delete(row._id);
        const document = await ctx.db.get(row.documentId);
        if (document)
          await ctx.db.patch(document._id, {
            updatedAt: Math.max(Date.now(), document.updatedAt + 1),
            updatedBy: user._id,
          });
        changed++;
      })
    );
    return { changed, isDone: page.isDone, continueCursor: page.continueCursor };
  }
  const page = await ctx.db
    .query("savedViews")
    .withIndex("by_workspace_project_deleted", (q) => q.eq("workspaceId", label.workspaceId))
    .paginate(opts);
  await Promise.all(
    page.page.map(async (row) => {
      const filters = removeLabelFilter(row.filters, label._id);
      if (filters !== row.filters) {
        await ctx.db.patch(row._id, {
          filters,
          updatedAt: Math.max(Date.now(), row.updatedAt + 1),
        });
        changed++;
      }
    })
  );
  return { changed, isDone: page.isDone, continueCursor: page.continueCursor };
}
export async function stepTaskLabelRemoval(ctx: MutationCtx, job: Doc<"labelRemovalJobs">, user: Doc<"users">) {
  if (job.status !== "running") return { done: true, changed: 0 };
  if (
    !job.rootLabelId ||
    job.rootRevision === undefined ||
    job.labelIds !== undefined ||
    job.documentLabelIndex !== undefined ||
    job.cursor !== undefined
  )
    throw new ConvexError("Legacy removal must be reconciled before continuing.");
  await ctx.db.patch(job._id, { started: true });
  const work = await ctx.db
    .query("labelRemovalWork")
    .withIndex("by_job_phase", (q) => q.eq("jobId", job._id).eq("phase", job.phase))
    .first();
  if (!work) {
    if (job.phase === "delete") {
      await ctx.db.patch(job._id, { status: "completed" });
      return { done: true, changed: 0 };
    }
    const next = {
      discover: "tasks",
      tasks: "drafts",
      drafts: "documents",
      documents: "views",
      views: "delete",
    } as const;
    await ctx.db.patch(job._id, { phase: next[job.phase] });
    return { done: false, changed: 0 };
  }
  const label = await ctx.db.get(work.labelId);
  if (!label) {
    // The coherent sole physical-delete producer finishes ALL reference phases before ANY deletion.
    await ctx.db.patch(work._id, { phase: "delete", cursor: null });
    if (job.phase === "delete") await ctx.db.delete(work._id);
    return { done: false, changed: 0 };
  }
  requireTaskLabelAdopted(label);
  if (job.phase === "delete") {
    await ctx.db.delete(label._id);
    await ctx.db.delete(work._id);
    return { done: false, changed: 0 };
  }
  if (job.phase === "discover") {
    const page = await ctx.db
      .query("taskLabels")
      .withIndex("by_parent", (q) => q.eq("parentId", label._id))
      .paginate({ cursor: work.cursor, numItems: 20, maximumRowsRead: 20, maximumBytesRead: 1_048_576 });
    await Promise.all(
      page.page.map(async (child) => {
        const visited = await ctx.db
          .query("labelRemovalWork")
          .withIndex("by_job_label", (q) => q.eq("jobId", job._id).eq("labelId", child._id))
          .unique();
        if (visited) return;
        requireTaskLabelAdopted(child);
        await ctx.db.patch(child._id, {
          retiring: true,
          revision: child.revision + 1,
          updatedBy: user._id,
          updatedAt: Date.now(),
        });
        await ctx.db.insert("labelRemovalWork", {
          jobId: job._id,
          labelId: child._id,
          phase: "discover",
          cursor: null,
        });
      })
    );
    await ctx.db.patch(work._id, {
      phase: page.isDone ? "tasks" : "discover",
      cursor: page.isDone ? null : page.continueCursor,
    });
    return { done: false, changed: 0 };
  }
  const result = await stepLabelReferences(ctx, work, label, user);
  const next = { tasks: "drafts", drafts: "documents", documents: "views", views: "delete" } as const;
  await ctx.db.patch(work._id, {
    phase: result.isDone ? next[job.phase] : job.phase,
    cursor: result.isDone ? null : result.continueCursor,
  });
  await ctx.db.patch(job._id, { changed: job.changed + result.changed });
  return { done: false, changed: result.changed };
}
export const continueRemoval = internalMutation({
  args: { jobId: v.id("labelRemovalJobs"), userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.status !== "running") return null;
    const access = await requireProjectForUser(ctx, job.projectId, await requireAccountUser(ctx, args.userId));
    if (access.projectMember.role === "guest" || access.workspace._id !== job.workspaceId)
      throw new ConvexError("You do not have permission to remove this label.");
    const result = await stepTaskLabelRemoval(ctx, job, access.user);
    if (!result.done) await ctx.scheduler.runAfter(0, internal.tasks.label_removal.continueRemoval, args);
    return null;
  },
});
// Temporary exact-preimage migration; never invent missing running-job history.
export const adoptHistory = internalMutation({
  args: {
    expected: v.array(
      v.object({
        ...taskTables.labelRemovalJobs.validator.fields,
        _id: v.id("labelRemovalJobs"),
        _creationTime: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    if (args.expected.length < 1 || args.expected.length > 20)
      throw new ConvexError("Adopt between 1 and 20 exact removal preimages.");
    const changes = [];
    // Each comparison must precede its own mutation and returned postimage.
    /* oxlint-disable no-await-in-loop */
    for (const expected of args.expected) {
      const current = await ctx.db.get(expected._id);
      if (!current || compareValues(current, expected) !== 0)
        throw new ConvexError("Removal changed. Capture its current preimage.");
      if (current.status === "running") throw new ConvexError("Running legacy removals must complete before cutover.");
      if (
        current.rootLabelId !== undefined &&
        current.labelIds === undefined &&
        current.documentLabelIndex === undefined &&
        current.cursor === undefined
      )
        continue;
      if (current.rootLabelId !== undefined || !current.labelIds?.length || current.rootRevision !== undefined)
        throw new ConvexError("Partial removal adoption requires explicit review.");
      await ctx.db.patch(current._id, {
        rootLabelId: current.labelIds[0],
        labelIds: undefined,
        documentLabelIndex: undefined,
        cursor: undefined,
      });
      changes.push({ before: current, after: await ctx.db.get(current._id) });
    }
    /* oxlint-enable no-await-in-loop */
    return changes;
  },
});
