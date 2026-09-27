import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
export async function requireUsableLabel(ctx: QueryCtx, id: Id<"taskLabels">) {
  const label = await ctx.db.get(id);
  if (!label || label.retiring) throw new ConvexError("Label is unavailable or being removed.");
  return label;
}
