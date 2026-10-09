import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProject, requireWorkspaceForUser } from "../identity/access";
import { canAdministerProject } from "../projects/administration";
import { projectReader } from "../savedViews/scope";
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

// Both REST parent assignment and projection prove the parent’s own current scope.
export async function canReadLabel(ctx: QueryCtx, label: Doc<"taskLabels"> | null, user: Doc<"users">) {
  if (!label || label.retiring) return false;
  try {
    await requireWorkspaceForUser(ctx, label.workspaceId, user);
  } catch (error) {
    if (error instanceof ConvexError) return false;
    throw error;
  }
  if (label.projectId === null) return true;
  const read = projectReader(ctx, label.workspaceId, user._id);
  return (await read(label.projectId)) !== null;
}
