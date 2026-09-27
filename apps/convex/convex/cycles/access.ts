import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import { cyclePhase } from "./dates";
export async function requireCycle(ctx: QueryCtx, cycleId: Id<"cycles">, write = false, includeDeleted = false) {
  const cycle = await ctx.db.get(cycleId);
  if (!cycle || (cycle.deleted && !includeDeleted)) throw new ConvexError("Cycle not found.");
  const access = await requireProject(ctx, cycle.projectId, write);
  return { ...access, cycle };
}
export function requireCycleRevision(cycle: Doc<"cycles">, expectedUpdatedAt: number) {
  if (!Number.isSafeInteger(expectedUpdatedAt) || cycle.updatedAt !== expectedUpdatedAt)
    throw new ConvexError("This cycle changed. Reload before saving.");
}
export function requireOpenCycle(cycle: Doc<"cycles">) {
  if (cycle.deleted || cycle.archived || cyclePhase(cycle) === "completed")
    throw new ConvexError("Completed, archived or deleted cycles cannot be changed.");
}
export async function checkSchedule(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  startDate: string | null,
  endDate: string | null,
  except?: Id<"cycles">
) {
  const cycles = await ctx.db
    .query("cycles")
    .withIndex("by_project", (q) => q.eq("projectId", projectId).eq("deleted", false))
    .take(201);
  if (!except && cycles.length >= 200) throw new ConvexError("This project has reached its 200 cycle limit.");
  if (
    startDate &&
    endDate &&
    cycles.some(
      (c) =>
        c._id !== except &&
        c.startDate !== null &&
        c.endDate !== null &&
        c.startDate <= endDate &&
        c.endDate >= startDate
    )
  )
    throw new ConvexError("These dates overlap another cycle in this project.");
}
