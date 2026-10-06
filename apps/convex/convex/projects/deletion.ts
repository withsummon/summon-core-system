import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { changeProjectDeleted, type requireLifecycle } from "./lifecycle";
import { changeFavoriteDeleted } from "../favorites/write";
import { writeTaskLifecycle } from "../tasks/lifecycle";
import { taskChanged } from "../tasks/revision";
import { removeRelationship } from "../tasks/relationships";
import { changeDraftDeleted } from "../tasks/drafts/index";
import { changeViewDeleted } from "../savedViews/index";
import { changeCycleDeleted } from "../cycles/index";
import { changeModuleDeleted } from "../modules/index";
import { estimateConfig, retireEstimate } from "../estimates/access";
import { writeDocumentMetadata } from "../documents/index";
import { deactivateProjectMembership } from "./index";

const budget = { numItems: 50, maximumRowsRead: 50, maximumBytesRead: 1_048_576 };
type Job = Doc<"projectDeletionJobs">;

// This durable intent is specific to REST retirement. Native Trash never creates
// it: recovery there retains children, whereas REST retirement is irreversible.
export async function beginProjectDeletion(ctx: MutationCtx, access: Awaited<ReturnType<typeof requireLifecycle>>) {
  const { project, user } = access;
  if (project.deletedAt != null) throw new ConvexError({ status: 404, detail: "Project not found." });
  const deletedAt = await changeProjectDeleted(ctx, access, project.metadataRevision, true);
  if (deletedAt === null) throw new Error("Project retirement did not acquire a tombstone.");
  const jobId = await ctx.db.insert("projectDeletionJobs", {
    projectId: project._id,
    workspaceId: project.workspaceId,
    actorId: user._id,
    deletedAt,
    phase: "favorites",
    cursor: null,
    collectionCursor: null,
    taskId: null,
    collectionDone: false,
    systemId: null,
    revision: 0,
  });
  await ctx.scheduler.runAfter(0, internal.projects.deletion.step, { jobId, expectedRevision: 0 });
}

async function taskPage(ctx: MutationCtx, job: Job) {
  const rows = await ctx.db
    .query("tasks")
    .withIndex("by_project", (q) => q.eq("projectId", job.projectId))
    .paginate({ ...budget, numItems: 1, cursor: job.collectionCursor });
  const task = rows.page[0];
  if (!task)
    return { phase: rows.isDone ? "drafts" : "tasks", collectionCursor: rows.continueCursor } satisfies Partial<Job>;
  if (task.workspaceId !== job.workspaceId) throw new Error("Retired task belongs to another workspace.");
  if (task.deletedAt === null) await writeTaskLifecycle(ctx, task, job.actorId, "deletedAt", true, "activity");
  const edge = await ctx.db
    .query("taskParents")
    .withIndex("by_child", (q) => q.eq("childId", task._id))
    .unique();
  if (edge) await unlinkParent(ctx, edge, job);
  return {
    phase: "parents",
    cursor: null,
    taskId: task._id,
    collectionCursor: rows.continueCursor,
    collectionDone: rows.isDone,
  } satisfies Partial<Job>;
}
async function unlinkParent(ctx: MutationCtx, edge: Doc<"taskParents">, job: Job) {
  const [child, parent] = await Promise.all([ctx.db.get(edge.childId), ctx.db.get(edge.parentId)]);
  if (!child || !parent || child.workspaceId !== job.workspaceId || parent.workspaceId !== job.workspaceId)
    throw new Error("Retired parent relationship has invalid workspace ownership.");
  await ctx.db.delete(edge._id);
  await taskChanged(ctx, child, job.actorId, undefined, "activity");
  await taskChanged(ctx, parent, job.actorId, undefined, "activity");
}
async function taskDependents(ctx: MutationCtx, job: Job) {
  const task = job.taskId ? await ctx.db.get(job.taskId) : null;
  if (!task || task.projectId !== job.projectId || task.workspaceId !== job.workspaceId)
    throw new Error("Retirement task ownership changed.");
  switch (job.phase) {
    case "parents": {
      const rows = await ctx.db
        .query("taskParents")
        .withIndex("by_parent", (q) => q.eq("parentId", task._id))
        .paginate({ ...budget, numItems: 10, maximumRowsRead: 10, cursor: job.cursor });
      // Each edge updates the same parent revision; serialize its activity transactions.
      for (const edge of rows.page) {
        // oxlint-disable-next-line no-await-in-loop
        await unlinkParent(ctx, edge, job);
      }
      return {
        phase: rows.isDone ? "draftParents" : "parents",
        cursor: rows.isDone ? null : rows.continueCursor,
      } satisfies Partial<Job>;
    }
    case "draftParents": {
      const rows = await ctx.db
        .query("taskDrafts")
        .withIndex("by_parent", (q) => q.eq("parent.taskId", task._id))
        .paginate({ ...budget, cursor: job.cursor });
      await Promise.all(
        rows.page.map(async (draft) => {
          if (draft.workspaceId !== job.workspaceId)
            throw new Error("Retired draft parent belongs to another workspace.");
          await ctx.db.patch(draft._id, {
            parent: null,
            contentRevision: draft.contentRevision + 1,
            updatedAt: Math.max(Date.now(), draft.updatedAt + 1),
          });
        })
      );
      return {
        phase: rows.isDone ? "relationsFrom" : "draftParents",
        cursor: rows.isDone ? null : rows.continueCursor,
      } satisfies Partial<Job>;
    }
    case "relationsFrom":
    case "relationsTo": {
      return relationshipPage(ctx, job, task);
    }
    default:
      throw new Error("Retirement is not processing task dependents.");
  }
}
async function relationshipPage(ctx: MutationCtx, job: Job, task: Doc<"tasks">) {
  const rows = await ctx.db
    .query("taskRelations")
    .withIndex(job.phase === "relationsFrom" ? "by_from" : "by_to", (q) =>
      job.phase === "relationsFrom" ? q.eq("fromId", task._id) : q.eq("toId", task._id)
    )
    .paginate({ ...budget, numItems: 10, maximumRowsRead: 10, cursor: job.cursor });
  // Every relationship advances the same task revision and activity.
  for (const relation of rows.page) {
    // oxlint-disable-next-line no-await-in-loop
    const related = await ctx.db.get(relation.fromId === task._id ? relation.toId : relation.fromId);
    if (!related || related.workspaceId !== job.workspaceId || relation.workspaceId !== job.workspaceId)
      throw new Error("Retired relationship belongs to another workspace.");
    // oxlint-disable-next-line no-await-in-loop
    await removeRelationship(ctx, relation, task, related, job.actorId, "activity");
  }
  const phase = job.phase === "relationsFrom" ? "relationsTo" : job.collectionDone ? "drafts" : "tasks";
  return {
    phase: rows.isDone ? phase : job.phase,
    cursor: rows.isDone ? null : rows.continueCursor,
    ...(rows.isDone && job.phase === "relationsTo" ? { taskId: null } : {}),
  } satisfies Partial<Job>;
}
async function projectPage(ctx: MutationCtx, job: Job) {
  const pagination = { ...budget, cursor: job.cursor };
  switch (job.phase) {
    case "drafts": {
      const rows = await ctx.db
        .query("taskDrafts")
        .withIndex("by_project", (q) => q.eq("projectId", job.projectId))
        .paginate(pagination);
      await Promise.all(
        rows.page.map(async (row) => {
          if (row.workspaceId !== job.workspaceId) throw new Error("Retired draft belongs to another workspace.");
          if (row.deletedAt === null) await changeDraftDeleted(ctx, row, true, Math.max(Date.now(), row.updatedAt + 1));
        })
      );
      return {
        phase: rows.isDone ? "views" : "drafts",
        cursor: rows.isDone ? null : rows.continueCursor,
      } satisfies Partial<Job>;
    }
    case "views": {
      const rows = await ctx.db
        .query("savedViews")
        .withIndex("by_project_deleted", (q) => q.eq("projectId", job.projectId))
        .paginate(pagination);
      await Promise.all(
        rows.page.map(async (row) => {
          if (row.workspaceId !== job.workspaceId) throw new Error("Retired view belongs to another workspace.");
          if (row.deletedAt === null) await changeViewDeleted(ctx, row, true);
        })
      );
      return {
        phase: rows.isDone ? "cycles" : "views",
        cursor: rows.isDone ? null : rows.continueCursor,
      } satisfies Partial<Job>;
    }
    case "cycles": {
      const rows = await ctx.db
        .query("cycles")
        .withIndex("by_project", (q) => q.eq("projectId", job.projectId))
        .paginate(pagination);
      await Promise.all(
        rows.page.map(async (row) => {
          if (row.workspaceId !== job.workspaceId) throw new Error("Retired cycle belongs to another workspace.");
          if (!row.deleted) await changeCycleDeleted(ctx, row, true);
        })
      );
      return {
        phase: rows.isDone ? "modules" : "cycles",
        cursor: rows.isDone ? null : rows.continueCursor,
      } satisfies Partial<Job>;
    }
    case "modules": {
      const rows = await ctx.db
        .query("modules")
        .withIndex("by_project", (q) => q.eq("projectId", job.projectId))
        .paginate(pagination);
      await Promise.all(
        rows.page.map(async (row) => {
          if (row.workspaceId !== job.workspaceId) throw new Error("Retired module belongs to another workspace.");
          if (!row.deleted) await changeModuleDeleted(ctx, row, true);
        })
      );
      return {
        phase: rows.isDone ? "estimates" : "modules",
        cursor: rows.isDone ? null : rows.continueCursor,
      } satisfies Partial<Job>;
    }
    default:
      throw new Error("Retirement is not processing a project collection.");
  }
}
async function projectLinks(ctx: MutationCtx, job: Job) {
  const pagination = { ...budget, cursor: job.cursor };
  switch (job.phase) {
    case "favorites": {
      const rows = await ctx.db
        .query("favorites")
        .withIndex("by_project_type_deleted", (q) =>
          q.eq("workspaceId", job.workspaceId).eq("targetProjectId", job.projectId)
        )
        .paginate(pagination);
      for (const row of rows.page) if (row.deletedAt === null) await changeFavoriteDeleted(ctx, row, true);
      return {
        phase: rows.isDone ? "tasks" : "favorites",
        cursor: rows.isDone ? null : rows.continueCursor,
      } satisfies Partial<Job>;
    }
    case "pages": {
      if (job.cursor === null) {
        const config = await estimateConfig(ctx, job.projectId);
        if (config)
          await ctx.db.patch(config._id, {
            activeSystemId: null,
            lastUsedSystemId: null,
            jobId: null,
            revision: config.revision + 1,
          });
      }
      const rows = await ctx.db
        .query("documents")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", job.workspaceId))
        .paginate(pagination);
      for (const row of rows.page)
        if (row.projectIds.includes(job.projectId))
          await writeDocumentMetadata(
            ctx,
            row,
            { projectIds: row.projectIds.filter((id) => id !== job.projectId) },
            job.actorId
          );
      return {
        phase: rows.isDone ? "members" : "pages",
        cursor: rows.isDone ? null : rows.continueCursor,
      } satisfies Partial<Job>;
    }
    case "members": {
      const rows = await ctx.db
        .query("projectMembers")
        .withIndex("by_project_user", (q) => q.eq("projectId", job.projectId))
        .paginate(pagination);
      await Promise.all(
        rows.page.map(async (row) => {
          if (row.workspaceId !== job.workspaceId) throw new Error("Retired membership belongs to another workspace.");
          if (row.active) await deactivateProjectMembership(ctx, row);
        })
      );
      return {
        phase: rows.isDone ? "complete" : "members",
        cursor: rows.isDone ? null : rows.continueCursor,
      } satisfies Partial<Job>;
    }
    default:
      throw new Error("Retirement is not processing project links.");
  }
}
async function estimatePage(ctx: MutationCtx, job: Job) {
  if (job.phase === "estimates") {
    const rows = await ctx.db
      .query("estimateSystems")
      .withIndex("by_project", (q) => q.eq("projectId", job.projectId))
      .paginate({ ...budget, numItems: 1, cursor: job.cursor });
    const system = rows.page[0];
    if (!system)
      return {
        phase: rows.isDone ? "pages" : "estimates",
        cursor: rows.isDone ? null : rows.continueCursor,
      } satisfies Partial<Job>;
    if (system.workspaceId !== job.workspaceId) throw new Error("Retired estimate belongs to another workspace.");
    if (!system.deleted) await retireEstimate(ctx, system, job.actorId);
    return {
      phase: "estimatePoints",
      systemId: system._id,
      collectionCursor: rows.continueCursor,
      collectionDone: rows.isDone,
      cursor: null,
    } satisfies Partial<Job>;
  }
  const system = job.systemId ? await ctx.db.get(job.systemId) : null;
  if (!system || system.projectId !== job.projectId || system.workspaceId !== job.workspaceId)
    throw new Error("Retired estimate ownership changed.");
  const rows = await ctx.db
    .query("estimatePoints")
    .withIndex("by_system", (q) => q.eq("systemId", system._id))
    .paginate({ ...budget, cursor: job.cursor });
  await Promise.all(
    rows.page.map(async (point) => {
      if (point.projectId !== job.projectId) throw new Error("Retired estimate point belongs to another project.");
      if (!point.deleted) await retireEstimate(ctx, point, job.actorId);
    })
  );
  return {
    phase: rows.isDone ? (job.collectionDone ? "pages" : "estimates") : "estimatePoints",
    cursor: rows.isDone ? (job.collectionDone ? null : job.collectionCursor) : rows.continueCursor,
    ...(rows.isDone ? { systemId: null } : {}),
  } satisfies Partial<Job>;
}

export const step = internalMutation({
  args: { jobId: v.id("projectDeletionJobs"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.phase === "complete" || job.revision !== args.expectedRevision) return;
    const project = await ctx.db.get(job.projectId);
    if (!project || project.workspaceId !== job.workspaceId || project.deletedAt !== job.deletedAt)
      throw new Error("Project retirement ownership changed.");
    let update;
    if (job.phase === "tasks") update = await taskPage(ctx, job);
    else if (["parents", "draftParents", "relationsFrom", "relationsTo"].includes(job.phase))
      update = await taskDependents(ctx, job);
    else if (job.phase === "estimates" || job.phase === "estimatePoints") update = await estimatePage(ctx, job);
    else if (["favorites", "pages", "members"].includes(job.phase)) update = await projectLinks(ctx, job);
    else update = await projectPage(ctx, job);
    const revision = job.revision + 1;
    await ctx.db.patch(job._id, { ...update, revision });
    if (update.phase !== "complete")
      await ctx.scheduler.runAfter(0, internal.projects.deletion.step, { jobId: job._id, expectedRevision: revision });
  },
});
