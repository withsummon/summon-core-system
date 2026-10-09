import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
export async function canAdministerProject(
  ctx: QueryCtx,
  project: Doc<"projects">,
  userId: Id<"users">,
  workspaceRole: string
) {
  if (workspaceRole === "admin") return true;
  if (workspaceRole === "guest") return false;
  const member = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_user", (q) => q.eq("projectId", project._id).eq("userId", userId))
    .unique();
  return member?.active === true && member.role === "admin";
}
