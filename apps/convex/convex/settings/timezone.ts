import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
export const DEFAULT_WORKSPACE_TIMEZONE = "UTC";
export function validateTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format(0);
  } catch {
    throw new ConvexError("Enter a supported IANA timezone.");
  }
  return timezone;
}
export async function workspaceTimezone(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  const stored = await ctx.db
    .query("workspaceSettings")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .unique();
  return stored?.timezone ?? DEFAULT_WORKSPACE_TIMEZONE;
}
