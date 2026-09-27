import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { requireProject } from "../identity/access";
import { requireProjectTimezone } from "../projects/timezone";
import { cycleFields } from "./schema";
import { validateCycleDates, cyclePhase } from "./dates";
import { requireCycle, requireCycleRevision, requireOpenCycle, checkSchedule } from "./access";
function details(name: string, description: string) {
  if (!name.trim() || name.length > 255 || description.length > 10000)
    throw new ConvexError("Use a cycle name up to 255 characters and description up to 10,000.");
  return { name: name.trim(), description };
}
export const create = mutation({
  args: { projectId: v.id("projects"), ...cycleFields },
  handler: async (ctx, args) => {
    const { project, user } = await requireProject(ctx, args.projectId, true);
    validateCycleDates(args.startDate, args.endDate);
    await checkSchedule(ctx, project._id, args.startDate, args.endDate);
    return ctx.db.insert("cycles", {
      ...args,
      ...details(args.name, args.description),
      workspaceId: project.workspaceId,
      timezone: requireProjectTimezone(project),
      createdBy: user._id,
      updatedAt: Date.now(),
      archived: false,
      deleted: false,
    });
  },
});
export const update = mutation({
  args: { cycleId: v.id("cycles"), expectedUpdatedAt: v.number(), ...cycleFields },
  handler: async (ctx, { cycleId, expectedUpdatedAt, ...fields }) => {
    const { cycle } = await requireCycle(ctx, cycleId, true);
    requireCycleRevision(cycle, expectedUpdatedAt);
    requireOpenCycle(cycle);
    validateCycleDates(fields.startDate, fields.endDate);
    await checkSchedule(ctx, cycle.projectId, fields.startDate, fields.endDate, cycle._id);
    await ctx.db.patch(cycle._id, {
      ...fields,
      ...details(fields.name, fields.description),
      updatedAt: Math.max(Date.now(), cycle.updatedAt + 1),
    });
  },
});
async function cycleDetail(ctx: QueryCtx, cycleId: Id<"cycles">, now: number) {
  const { cycle, user, member, projectMember } = await requireCycle(ctx, cycleId, false, true);
  const phase = cyclePhase(cycle, now);
  const canWrite = member.role !== "guest" && projectMember.role !== "guest";
  return {
    ...cycle,
    phase,
    canWrite,
    canEdit: canWrite && !cycle.deleted && !cycle.archived && phase !== "completed",
    canDelete: canWrite && (cycle.createdBy === user._id || projectMember.role === "admin"),
  };
}
export const get = query({
  args: { cycleId: v.id("cycles"), now: v.number() },
  handler: (ctx, args) => cycleDetail(ctx, args.cycleId, args.now),
});
export const resolve = query({
  args: { cycleId: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    const cycleId = ctx.db.normalizeId("cycles", args.cycleId);
    if (!cycleId) throw new ConvexError("Cycle not found.");
    return cycleDetail(ctx, cycleId, args.now);
  },
});
export const list = query({
  args: { projectId: v.id("projects"), deleted: v.boolean(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireProject(ctx, args.projectId);
    if (
      !Number.isSafeInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    )
      throw new ConvexError("Choose 1–100 cycles per page.");
    const result = await ctx.db
      .query("cycles")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId).eq("deleted", args.deleted))
      .order("desc")
      .paginate({ ...args.paginationOpts, maximumRowsRead: 100, maximumBytesRead: 1_048_576 });
    return result;
  },
});
export const lifecycle = mutation({
  args: {
    cycleId: v.id("cycles"),
    expectedUpdatedAt: v.number(),
    operation: v.union(v.literal("archive"), v.literal("unarchive"), v.literal("delete"), v.literal("restore")),
  },
  handler: async (ctx, args) => {
    const { cycle, user, projectMember } = await requireCycle(ctx, args.cycleId, true, true);
    requireCycleRevision(cycle, args.expectedUpdatedAt);
    if (args.operation === "delete" || args.operation === "restore") {
      if (cycle.createdBy !== user._id && projectMember.role !== "admin")
        throw new ConvexError("Only the cycle creator or a project administrator can delete or restore it.");
      if (cycle.deleted === (args.operation === "delete")) return;
      if (args.operation === "restore") await checkSchedule(ctx, cycle.projectId, cycle.startDate, cycle.endDate);
      await ctx.db.patch(cycle._id, {
        deleted: args.operation === "delete",
        updatedAt: Math.max(Date.now(), cycle.updatedAt + 1),
      });
    } else {
      if (cycle.deleted) throw new ConvexError("Restore this cycle first.");
      if (args.operation === "archive" && cyclePhase(cycle) !== "completed")
        throw new ConvexError("Only completed cycles can be archived.");
      if (cycle.archived === (args.operation === "archive")) return;
      await ctx.db.patch(cycle._id, {
        archived: args.operation === "archive",
        updatedAt: Math.max(Date.now(), cycle.updatedAt + 1),
      });
    }
  },
});
