import { v, ConvexError } from "convex/values";
import { query } from "../_generated/server";
import { requireProject } from "../identity/access";
import { requireTask } from "../tasks/access";
import { estimateConfig } from "./access";
export const choices = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const access = await requireProject(ctx, args.projectId);
    const config = await estimateConfig(ctx, args.projectId);
    const system = config?.activeSystemId ? await ctx.db.get(config.activeSystemId) : null;
    const points =
      system && !system.deleted && !system.retiring
        ? await ctx.db
            .query("estimatePoints")
            .withIndex("by_system", (q) => q.eq("systemId", system._id).eq("deleted", false))
            .take(101)
        : [];
    return {
      system: system && !system.deleted ? system : null,
      // ES2022 consumers do not provide toSorted; filter already creates an independent array.
      // eslint-disable-next-line unicorn/no-array-sort
      points: points.filter((point) => !point.retiring).sort((a, b) => a.key - b.key),
      canAssign: access.member.role !== "guest" && access.projectMember.role !== "guest",
      jobId: config?.jobId ?? null,
    };
  },
});
export const forTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId, "read");
    if (!task.estimatePointId) return null;
    const point = await ctx.db.get(task.estimatePointId);
    if (!point || point.projectId !== task.projectId) throw new ConvexError("Task estimate reference is invalid.");
    const system = await ctx.db.get(point.systemId);
    return { point, system };
  },
});
