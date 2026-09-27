import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { requireUnrestrictedAccount } from "../identity/deactivation/access";
const forbidden = /[&+,:;$^}{*=?@#|'<>.()%!-]/;
export function projectIdentifier(
  value: string,
  errorMessage = "Enter a project identifier of 1–12 characters without reserved punctuation."
) {
  const identifier = value.trim().toUpperCase();
  if (!identifier || identifier.length > 12 || forbidden.test(identifier)) throw new ConvexError(errorMessage);
  return identifier;
}
export async function validateProjectMetadata(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  values: { name: string; identifier: string; description: string },
  currentId?: Id<"projects">
) {
  const name = values.name.trim();
  if (!name || name.length > 255 || forbidden.test(name))
    throw new ConvexError("Enter a project name of 1–255 characters without reserved punctuation.");
  const identifier = projectIdentifier(values.identifier);
  if (values.description.length > 20000) throw new ConvexError("Description must contain at most 20,000 characters.");
  const sameName = await ctx.db
    .query("projects")
    .withIndex("by_workspace_name", (q) => q.eq("workspaceId", workspaceId).eq("name", name))
    .filter((q) => q.neq(q.field("_id"), currentId ?? null))
    .first();
  const sameIdentifier = await ctx.db
    .query("projects")
    .withIndex("by_workspace_identifier", (q) => q.eq("workspaceId", workspaceId).eq("identifier", identifier))
    .first();
  if (sameName) throw new ConvexError("This project name is already taken.");
  if (sameIdentifier && sameIdentifier._id !== currentId)
    throw new ConvexError("This project identifier is already taken.");
  return { name, identifier, description: values.description };
}
export async function validateProjectLead(ctx: QueryCtx, workspaceId: Id<"workspaces">, leadId: Id<"users"> | null) {
  if (leadId === null) return;
  const member = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", leadId))
    .unique();
  if (!member?.active || !(await ctx.db.get(leadId)))
    throw new ConvexError("Project lead must be an active member of this workspace.");
  await requireUnrestrictedAccount(ctx, leadId);
}
