import type { PaginationOptions } from "convex/server";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { pageBudget } from "./validation";

/** Caller must authorize workspace access before reading the member directory. */
export async function workspaceMember(ctx: QueryCtx, workspaceId: Id<"workspaces">, userId: Id<"users">) {
  const membership = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", userId))
    .unique();
  if (!membership?.active) return null;
  const user = await ctx.db.get(userId);
  return user ? { id: user._id, name: user.name ?? null, email: user.email ?? null } : null;
}
export async function workspaceMembers(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  paginationOpts: PaginationOptions,
  search = ""
) {
  const memberships = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId))
    .filter((q) => q.eq(q.field("active"), true))
    .paginate(pageBudget(paginationOpts));
  const query = search.trim().toLocaleLowerCase();
  const users = await Promise.all(
    memberships.page.map(async (membership) => {
      const user = await ctx.db.get(membership.userId);
      if (!user) return null;
      const row = { id: user._id, name: user.name ?? null, email: user.email ?? null };
      return !query || `${row.name ?? ""} ${row.email ?? ""}`.toLocaleLowerCase().includes(query) ? row : null;
    })
  );
  return { ...memberships, page: users.filter((user) => user !== null) };
}
