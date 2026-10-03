import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
export async function requireModule(ctx: QueryCtx, moduleId: Id<"modules">, write = false, includeDeleted = false) {
  const module = await ctx.db.get(moduleId);
  if (!module || (module.deleted && !includeDeleted)) throw new ConvexError("Module not found.");
  const access = await requireProject(ctx, module.projectId, write);
  return { ...access, module };
}
export function requireModuleRevision(module: Doc<"modules">, expectedUpdatedAt: number) {
  if (!Number.isSafeInteger(expectedUpdatedAt) || module.updatedAt !== expectedUpdatedAt)
    throw new ConvexError("This module changed. Reload before saving.");
}
export function requireEditableModule(module: Doc<"modules">) {
  if (module.deleted || module.archived) throw new ConvexError("Restore or unarchive this module before changing it.");
}
export async function requireAvailableName(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  name: string,
  except?: Id<"modules">
) {
  const existing = await ctx.db
    .query("modules")
    .withIndex("by_project_name", (q) => q.eq("projectId", projectId).eq("deleted", false).eq("name", name))
    .unique();
  if (existing && existing._id !== except)
    throw new ConvexError("A module with this name already exists in this project.");
}
export async function requireModulePerson(ctx: QueryCtx, project: Doc<"projects">, userId: Id<"users">) {
  const [workspaceMember, projectMember] = await Promise.all([
    ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", project.workspaceId).eq("userId", userId))
      .unique(),
    ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", project._id).eq("userId", userId))
      .unique(),
  ]);
  if (!workspaceMember?.active || !projectMember?.active)
    throw new ConvexError("Choose an active member of this project.");
}
