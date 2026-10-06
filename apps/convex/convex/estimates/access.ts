import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
export async function estimateConfig(ctx: QueryCtx, projectId: Id<"projects">) {
  return ctx.db
    .query("projectEstimates")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .unique();
}
export async function requireSystem(ctx: QueryCtx, systemId: Id<"estimateSystems">, write = false) {
  const system = await ctx.db.get(systemId);
  if (!system || system.deleted) throw new ConvexError("Estimate system not found.");
  const permission = await requireProject(ctx, system.projectId, write);
  if (write) {
    const config = await estimateConfig(ctx, system.projectId);
    if (config?.jobId || system.retiring)
      throw new ConvexError("Finish the estimate replacement before editing configuration.");
  }
  return { ...permission, system };
}
export function checkEstimateRevision(actual: number, expected: number) {
  if (!Number.isSafeInteger(expected) || actual !== expected)
    throw new ConvexError("Estimate changed. Reopen before saving.");
}
export async function validateEstimatePoint(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  pointId: Id<"estimatePoints"> | null,
  retainedId?: Id<"estimatePoints"> | null
) {
  if (!pointId) return;
  const point = await ctx.db.get(pointId);
  const system = point ? await ctx.db.get(point.systemId) : null;
  if (!point || point.projectId !== projectId || point.deleted || !system || system.deleted)
    throw new ConvexError("Estimate point is unavailable in this project.");
  if (pointId === retainedId) return;
  const config = await estimateConfig(ctx, projectId);
  if (point.retiring || system.retiring || config?.activeSystemId !== point.systemId)
    throw new ConvexError("Choose a point from the active estimate system.");
}

export async function retireEstimate(
  ctx: MutationCtx,
  row: Doc<"estimateSystems"> | Doc<"estimatePoints">,
  actorId: Id<"users">
) {
  const now = Date.now();
  await ctx.db.patch(row._id, {
    deleted: true,
    retiring: false,
    revision: row.revision + 1,
    // systemId distinguishes the two real stored table shapes at this shared retirement owner.
    ...("systemId" in row ? { updatedBy: actorId, updatedAt: now, deletedAt: now } : {}),
  });
}
