import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
export function capabilities(view: Doc<"savedViews">, access: Awaited<ReturnType<typeof requireProject>>) {
  const own = view.ownerId === access.user._id;
  const manages = own || access.projectMember.role === "admin";
  const guest = access.member.role === "guest" || access.projectMember.role === "guest";
  if (view.deletedAt !== null)
    return { canRead: manages, canEdit: false, canRemove: false, canRestore: manages, canFavorite: false };
  return {
    canRead: !guest || !!access.project.guestViewAllFeatures || own,
    canEdit: own && !view.isLocked,
    canRemove: manages,
    canRestore: false,
    canFavorite: !guest,
  };
}
export async function requireView(ctx: QueryCtx, viewId: Id<"savedViews">, allowDeleted = false) {
  const view = await ctx.db.get(viewId);
  if (!view) throw new ConvexError("Saved view not found.");
  const access = await requireProject(ctx, view.projectId);
  const flags = capabilities(view, access);
  if (!flags.canRead || (!allowDeleted && view.deletedAt !== null)) throw new ConvexError("Saved view not found.");
  return { view, access, ...flags };
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
  return { view, isFavorite: view.deletedAt === null && favorite !== null, ...capabilities(view, access) };
}
export function requireRevision(view: Doc<"savedViews">, expected: number) {
  if (!Number.isSafeInteger(expected) || expected !== view.updatedAt)
    throw new ConvexError("This saved view changed. Reopen it before saving.");
}
