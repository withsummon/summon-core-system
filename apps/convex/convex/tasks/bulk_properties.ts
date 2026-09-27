import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { taskProperties, status } from "./schema";
import { requireTask } from "./access";
import { requireProject } from "../identity/access";
import { preparePropertyUpdate, applyPropertyUpdate } from "./property_updates";
const MAX_BULK_PROPERTIES = 20;
const patch = v.object({
  priority: v.optional(taskProperties.priority),
  estimatePointId: v.optional(taskProperties.estimatePointId),
  assigneeIds: v.optional(taskProperties.assigneeIds),
  labelIds: v.optional(taskProperties.labelIds),
  startDate: v.optional(taskProperties.startDate),
  targetDate: v.optional(taskProperties.targetDate),
  stateId: v.optional(taskProperties.stateId),
  status: v.optional(status),
});
export const update = mutation({
  args: {
    projectId: v.id("projects"),
    updates: v.array(v.object({ taskId: v.id("tasks"), expectedUpdatedAt: v.number(), patch })),
  },
  handler: async (ctx, args) => {
    await requireProject(ctx, args.projectId, true);
    if (
      !args.updates.length ||
      args.updates.length > MAX_BULK_PROPERTIES ||
      new Set(args.updates.map((row) => row.taskId)).size !== args.updates.length
    )
      throw new ConvexError(`Choose 1–${MAX_BULK_PROPERTIES} distinct tasks.`);
    const prepared = await Promise.all(
      args.updates.map(async (row) => {
        if (!Object.keys(row.patch).length) throw new ConvexError("Choose at least one property change.");
        const task = await requireTask(ctx, row.taskId);
        if (task.projectId !== args.projectId) throw new ConvexError("All selected tasks must belong to this project.");
        const { status: requestedStatus, ...propertyPatch } = row.patch;
        const data = {
          priority: task.priority,
          estimatePointId: task.estimatePointId,
          startDate: task.startDate,
          targetDate: task.targetDate,
          stateId: task.stateId,
          ...propertyPatch,
          assigneeIds: [...new Set([...task.assigneeIds, ...(row.patch.assigneeIds ?? [])])],
          labelIds: [...new Set([...task.labelIds, ...(row.patch.labelIds ?? [])])],
        };
        const state = data.stateId ? await ctx.db.get(data.stateId) : null;
        const nextStatus = requestedStatus ?? state?.status ?? task.status;
        if (nextStatus === "triage") throw new ConvexError("Use intake to manage triage tasks.");
        return preparePropertyUpdate(ctx, row.taskId, row.expectedUpdatedAt, data, nextStatus);
      })
    );
    await Promise.all(prepared.map((row) => applyPropertyUpdate(ctx, row)));
    return { changed: prepared.length };
  },
});
