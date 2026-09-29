import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { requireProject } from "../identity/access";
import schema from "../schema";
import { pageBudget, date } from "../commercial/validation";
import { requireProjectTimezone } from "../projects/timezone";
import { cycleFields } from "./schema";
import { validateCycleDates, validateCycleClock, cyclePhase } from "./dates";
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
  const access = await requireCycle(ctx, cycleId, false, true);
  return cycleProjection(access.cycle, access, now);
}
function cycleMetadata(
  cycle: Doc<"cycles">,
  { user, member, projectMember }: Awaited<ReturnType<typeof requireProject>>
) {
  const canWrite = member.role !== "guest" && projectMember.role !== "guest";
  const canDelete = canWrite && (cycle.createdBy === user._id || projectMember.role === "admin");
  return {
    ...cycle,
    canWrite,
    canDelete,
    canRestore: canDelete && cycle.deleted,
    canUnarchive: canWrite && !cycle.deleted && cycle.archived,
  };
}
function cycleProjection(cycle: Doc<"cycles">, access: Awaited<ReturnType<typeof requireProject>>, now: number) {
  const metadata = cycleMetadata(cycle, access);
  const phase = cyclePhase(cycle, now);
  return {
    ...metadata,
    phase,
    canEdit: metadata.canWrite && !cycle.deleted && !cycle.archived && phase !== "completed",
    canArchive: metadata.canWrite && !cycle.deleted && !cycle.archived && phase === "completed",
    canTransfer: metadata.canWrite && !cycle.deleted && !cycle.archived && phase === "completed",
  };
}
export const get = query({
  args: { cycleId: v.id("cycles"), now: v.number() },
  handler: (ctx, args) => cycleDetail(ctx, args.cycleId, args.now),
});
// The preserved list filters before pagination. Its clock is a captured filter
// value; the display clock can advance without resetting the loaded cursor interval.
export const browse = query({
  args: {
    projectId: v.id("projects"),
    view: v.union(v.literal("all"), v.literal("archived"), v.literal("trash")),
    now: v.number(),
    search: v.string(),
    phases: v.array(v.union(v.literal("draft"), v.literal("upcoming"), v.literal("current"), v.literal("completed"))),
    startDate: v.union(v.string(), v.null()),
    endDate: v.union(v.string(), v.null()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireProject(ctx, args.projectId);
    validateCycleClock(args.now);
    const startDate = date(args.startDate),
      endDate = date(args.endDate);
    if (startDate && endDate && startDate > endDate) throw new ConvexError("Start date cannot exceed end date.");
    if (args.search.length > 255) throw new ConvexError("Use a search up to 255 characters.");
    const search = args.search.trim().toLocaleLowerCase();
    return stream(ctx.db, schema)
      .query("cycles")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId).eq("deleted", args.view === "trash"))
      .order("desc")
      .filterWith(
        async (cycle) =>
          (args.view === "trash" || cycle.archived === (args.view === "archived")) &&
          cycle.name.toLocaleLowerCase().includes(search) &&
          (!args.phases.length || args.phases.includes(cyclePhase(cycle, args.now))) &&
          (!startDate || (cycle.startDate !== null && cycle.startDate >= startDate)) &&
          (!endDate || (cycle.endDate !== null && cycle.endDate <= endDate))
      )
      .map(async (cycle) => cycleProjection(cycle, access, args.now))
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const resolve = query({
  args: { cycleId: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    const cycleId = ctx.db.normalizeId("cycles", args.cycleId);
    if (!cycleId) throw new ConvexError("Cycle not found.");
    return cycleDetail(ctx, cycleId, args.now);
  },
});
export const address = query({
  args: { projectId: v.id("projects"), cycleId: v.string() },
  handler: async (ctx, args) => {
    const access = await requireProject(ctx, args.projectId);
    const cycleId = ctx.db.normalizeId("cycles", args.cycleId);
    const cycle = cycleId ? await ctx.db.get(cycleId) : null;
    if (!cycle || cycle.projectId !== access.project._id || cycle.workspaceId !== access.project.workspaceId)
      return null;
    return cycleMetadata(cycle, access);
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
