import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { workspaceScope } from "./scope";
import { requireProject, requireWorkspace } from "../identity/access";
export function capabilities(view: Doc<"savedViews">, access: Awaited<ReturnType<typeof requireProject>>) {
  return viewCapabilities(
    view,
    access.user._id,
    access.projectMember.role === "admin",
    access.member.role === "guest" || access.projectMember.role === "guest",
    !!access.project.guestViewAllFeatures
  );
}
export function viewCapabilities(
  view: Doc<"savedViews">,
  userId: Id<"users">,
  admin: boolean,
  guest: boolean,
  guestViewAll: boolean
) {
  const own = view.ownerId === userId;
  const manages = own || admin;
  if (view.deletedAt !== null)
    return { canRead: manages, canEdit: false, canRemove: false, canRestore: manages, canFavorite: false };
  return {
    canRead: !guest || guestViewAll || own,
    canEdit: own && !view.isLocked,
    canRemove: manages,
    canRestore: false,
    canFavorite: !guest,
  };
}
export async function requireView(ctx: QueryCtx, viewId: Id<"savedViews">, allowDeleted = false) {
  const view = await ctx.db.get(viewId);
  if (!view || view.projectId === null) throw new ConvexError("Saved view not found.");
  const access = await requireProject(ctx, view.projectId);
  const flags = capabilities(view, access);
  if (!flags.canRead || (!allowDeleted && view.deletedAt !== null)) throw new ConvexError("Saved view not found.");
  return { view: { ...view, projectId: view.projectId }, access, ...flags };
}
export async function projectView(
  ctx: QueryCtx,
  view: Doc<"savedViews">,
  access: Awaited<ReturnType<typeof requireProject>>
) {
  const favorite = await ctx.db
    .query("savedViewFavorites")
    .withIndex("by_view_user", (q) => q.eq("viewId", view._id).eq("userId", access.user._id))
    .unique();
  return {
    view: { ...view, projectId: access.project._id },
    isFavorite: view.deletedAt === null && favorite !== null,
    ...capabilities(view, access),
  };
}
export function requireRevision(view: Doc<"savedViews">, expected: number) {
  if (!Number.isSafeInteger(expected) || expected !== view.updatedAt)
    throw new ConvexError("This saved view changed. Reopen it before saving.");
}

export function workspaceCapabilities(view: Doc<"savedViews">, access: Awaited<ReturnType<typeof requireWorkspace>>) {
  return viewCapabilities(view, access.user._id, access.member.role === "admin", access.member.role === "guest", false);
}
export async function requireWorkspaceView(ctx: QueryCtx, viewId: Id<"savedViews">, allowDeleted = false) {
  const row = await ctx.db.get(viewId);
  if (!row || row.projectId !== null) throw new ConvexError("Saved view not found.");
  const workspaceId = workspaceScope(row);
  const view = { ...row, projectId: null, workspaceId };
  const access = await requireWorkspace(ctx, workspaceId);
  const flags = workspaceCapabilities(view, access);
  if (!flags.canRead || (!allowDeleted && view.deletedAt !== null)) throw new ConvexError("Saved view not found.");
  return { view, access, ...flags };
}
export async function workspaceView(
  ctx: QueryCtx,
  view: Doc<"savedViews">,
  access: Awaited<ReturnType<typeof requireWorkspace>>
) {
  const favorite = await ctx.db
    .query("savedViewFavorites")
    .withIndex("by_view_user", (q) => q.eq("viewId", view._id).eq("userId", access.user._id))
    .unique();
  return {
    view: { ...view, projectId: null, workspaceId: access.workspace._id },
    isFavorite: view.deletedAt === null && favorite !== null,
    ...workspaceCapabilities(view, access),
  };
}
