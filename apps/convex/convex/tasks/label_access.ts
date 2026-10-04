import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import { canAdministerProject } from "../projects/administration";
export async function requireLabelManagement(ctx: QueryCtx, projectId: Id<"projects">) {
  const access = await requireProject(ctx, projectId);
  if (
    access.member.role === "guest" ||
    !(await canAdministerProject(ctx, access.project, access.user._id, access.member.role))
  )
    throw new ConvexError("Only project administrators can manage labels.");
  return access;
}
export async function requireUsableLabel(ctx: QueryCtx, id: Id<"taskLabels">) {
  const label = await ctx.db.get(id);
  if (!label || label.retiring) throw new ConvexError("Label is unavailable or being removed.");
  return label;
}
