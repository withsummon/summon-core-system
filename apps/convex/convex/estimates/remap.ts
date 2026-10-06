import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireProject } from "../identity/access";
import { taskChanged } from "../tasks/revision";
import { requireSystem, estimateConfig, checkEstimateRevision, validateEstimatePoint, retireEstimate } from "./access";
export const begin = mutation({
  args: {
    systemId: v.id("estimateSystems"),
    pointId: v.union(v.id("estimatePoints"), v.null()),
    expectedSystemRevision: v.number(),
    expectedPointRevision: v.union(v.number(), v.null()),
    replacementId: v.union(v.id("estimatePoints"), v.null()),
  },
  handler: async (ctx, args) => {
    const { system, user } = await requireSystem(ctx, args.systemId, true);
    checkEstimateRevision(system.revision, args.expectedSystemRevision);
    const points = await ctx.db
      .query("estimatePoints")
      .withIndex("by_system", (q) => q.eq("systemId", system._id).eq("deleted", false))
      .take(101);
    if (points.length > 100) throw new ConvexError("Estimate point limit exceeded.");
    const selected = args.pointId ? points.filter((point) => point._id === args.pointId) : points;
    if (args.pointId) {
      const point = selected[0];
      if (!point) throw new ConvexError("Estimate point not found.");
      if (args.expectedPointRevision === null) throw new ConvexError("Point revision is required.");
      checkEstimateRevision(point.revision, args.expectedPointRevision);
    }
    if (args.replacementId && selected.some((point) => point._id === args.replacementId))
      throw new ConvexError("Choose a replacement outside the removed points.");
    await validateEstimatePoint(ctx, system.projectId, args.replacementId);
    const jobId = await ctx.db.insert("estimateRemaps", {
      projectId: system.projectId,
      actorId: user._id,
      systemId: system._id,
      pointIds: selected.map((point) => point._id),
      replacementId: args.replacementId,
      deleteSystem: args.pointId === null,
      phase: "tasks",
      cursor: null,
      changed: 0,
      revision: 0,
    });
    await Promise.all(
      selected.map((point) =>
        ctx.db.patch(point._id, {
          retiring: true,
          updatedBy: user._id,
          updatedAt: Date.now(),
          revision: point.revision + 1,
        })
      )
    );
    await ctx.db.patch(system._id, { retiring: args.pointId === null, revision: system.revision + 1 });
    const config = await estimateConfig(ctx, system.projectId);
    if (config) await ctx.db.patch(config._id, { jobId, revision: config.revision + 1 });
    else
      await ctx.db.insert("projectEstimates", {
        projectId: system.projectId,
        activeSystemId: null,
        lastUsedSystemId: null,
        jobId,
        revision: 1,
      });
    return jobId;
  },
});
export const get = query({
  args: { jobId: v.id("estimateRemaps") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new ConvexError("Estimate replacement not found.");
    await requireProject(ctx, job.projectId);
    return job;
  },
});
export const page = mutation({
  args: { jobId: v.id("estimateRemaps"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new ConvexError("Estimate replacement not found.");
    const { user } = await requireProject(ctx, job.projectId, true);
    if (job.phase === "complete") return job;
    checkEstimateRevision(job.revision, args.expectedRevision);
    await validateEstimatePoint(ctx, job.projectId, job.replacementId);
    const config = await estimateConfig(ctx, job.projectId);
    if (config?.jobId !== job._id) throw new ConvexError("Estimate replacement ownership changed.");
    let changed = 0;
    let nextPhase: "tasks" | "drafts" | "complete" = job.phase;
    let cursor: string | null = null;
    if (job.phase === "tasks") {
      const rows = await ctx.db
        .query("tasks")
        .withIndex("by_project", (q) => q.eq("projectId", job.projectId))
        .paginate({ cursor: job.cursor, numItems: 20, maximumRowsRead: 20, maximumBytesRead: 1_048_576 });
      const affected = rows.page.filter((task) => task.estimatePointId && job.pointIds.includes(task.estimatePointId));
      await Promise.all(
        affected.map(async (task) => {
          await ctx.db.patch(task._id, { estimatePointId: job.replacementId });
          await taskChanged(ctx, task, user._id);
        })
      );
      changed = affected.length;
      cursor = rows.isDone ? null : rows.continueCursor;
      if (rows.isDone) nextPhase = "drafts";
    } else {
      const rows = await ctx.db
        .query("taskDrafts")
        .withIndex("by_project", (q) => q.eq("projectId", job.projectId))
        .paginate({ cursor: job.cursor, numItems: 20, maximumRowsRead: 20, maximumBytesRead: 1_048_576 });
      const affected = rows.page.filter(
        (draft) =>
          !draft.publishedTaskId &&
          draft.properties.estimatePointId &&
          job.pointIds.includes(draft.properties.estimatePointId)
      );
      await Promise.all(
        affected.map((draft) =>
          ctx.db.patch(draft._id, {
            properties: { ...draft.properties, estimatePointId: job.replacementId },
            contentRevision: draft.contentRevision + 1,
            updatedAt: Math.max(Date.now(), draft.updatedAt + 1),
          })
        )
      );
      changed = affected.length;
      cursor = rows.continueCursor;
      if (rows.isDone) {
        const sourcePoints = await Promise.all(job.pointIds.map((id) => ctx.db.get(id)));
        await Promise.all(
          sourcePoints.filter((point) => point !== null).map((point) => retireEstimate(ctx, point, user._id))
        );
        const system = await ctx.db.get(job.systemId);
        if (!system) throw new ConvexError("Estimate system is missing.");
        if (job.deleteSystem) await retireEstimate(ctx, system, user._id);
        else {
          await ctx.db.patch(system._id, { revision: system.revision + 1 });
          const removed = sourcePoints[0];
          const remaining = await ctx.db
            .query("estimatePoints")
            .withIndex("by_system", (q) => q.eq("systemId", system._id).eq("deleted", false))
            .take(101);
          if (removed)
            await Promise.all(
              remaining
                .filter((point) => point.key > removed.key)
                .map((point) =>
                  ctx.db.patch(point._id, {
                    key: point.key - 1,
                    updatedBy: user._id,
                    updatedAt: Date.now(),
                    revision: point.revision + 1,
                  })
                )
            );
        }
        await ctx.db.patch(config._id, {
          jobId: null,
          activeSystemId: job.deleteSystem && config.activeSystemId === job.systemId ? null : config.activeSystemId,
          lastUsedSystemId:
            job.deleteSystem && config.lastUsedSystemId === job.systemId ? null : config.lastUsedSystemId,
          revision: config.revision + 1,
        });
        nextPhase = "complete";
        cursor = null;
      }
    }
    await ctx.db.patch(job._id, {
      phase: nextPhase,
      cursor,
      changed: job.changed + changed,
      revision: job.revision + 1,
    });
    return { ...job, phase: nextPhase, cursor, changed: job.changed + changed, revision: job.revision + 1 };
  },
});
