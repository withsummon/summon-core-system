import { effectiveFavorite, viewFavorite } from "../favorites/access";
import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProject, requireWorkspace } from "../identity/access";
import { renderedProjectLogo } from "../projects/branding_schema";
import { profileIdentity } from "../identity/profile_owner";
import { personalImageDescriptor, userAppearance } from "../identity/avatar_owner";
import { accountRestricted } from "../identity/deactivation/access";

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
  const visible = own || view.access === "public";
  if (view.deletedAt !== null)
    return { canRead: visible && manages, canEdit: false, canRemove: false, canRestore: manages, canFavorite: false };
  return {
    canRead: visible && (!guest || guestViewAll || own),
    canEdit: own && !view.isLocked,
    canRemove: manages,
    canRestore: false,
    canFavorite: !guest,
  };
}
export async function requireView(
  ctx: QueryCtx,
  viewId: Id<"savedViews">,
  allowDeleted = false,
  purpose: "read" | "lifecycle" = "read"
) {
  const view = await ctx.db.get(viewId);
  if (!view || view.projectId === null) throw new ConvexError("Saved view not found.");
  const access = await requireProject(ctx, view.projectId);
  const flags = capabilities(view, access);
  const allowed = purpose === "lifecycle" ? flags.canRemove || flags.canRestore : flags.canRead;
  if (!allowed || (!allowDeleted && view.deletedAt !== null)) throw new ConvexError("Saved view not found.");
  return { view: { ...view, projectId: view.projectId }, access, ...flags };
}
export async function projectView(
  ctx: QueryCtx,
  view: Doc<"savedViews">,
  access: Awaited<ReturnType<typeof requireProject>>
) {
  const favorite = await viewFavorite(ctx, view.workspaceId, access.user._id, view._id);
  const membership = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) => q.eq("workspaceId", view.workspaceId).eq("userId", view.ownerId))
    .unique();
  const identity =
    membership?.active && !(await accountRestricted(ctx, view.ownerId))
      ? await profileIdentity(ctx, view.ownerId)
      : null;
  return {
    view: { ...view, projectId: access.project._id },
    logo: renderedProjectLogo(view.logoProps),
    owner: identity
      ? {
          userId: identity.userId,
          displayName: identity.displayName,
          fullName: identity.fullName,
          avatar: await personalImageDescriptor(
            ctx,
            await userAppearance(ctx, view.ownerId),
            "avatar",
            view.workspaceId
          ),
        }
      : null,
    isFavorite: view.deletedAt === null && (await effectiveFavorite(ctx, favorite)),
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
export async function requireWorkspaceView(
  ctx: QueryCtx,
  viewId: Id<"savedViews">,
  allowDeleted = false,
  purpose: "read" | "lifecycle" = "read"
) {
  const row = await ctx.db.get(viewId);
  if (!row || row.projectId !== null) throw new ConvexError("Saved view not found.");
  const view = { ...row, projectId: null };
  const access = await requireWorkspace(ctx, row.workspaceId);
  const flags = workspaceCapabilities(view, access);
  const allowed = purpose === "lifecycle" ? flags.canRemove || flags.canRestore : flags.canRead;
  if (!allowed || (!allowDeleted && view.deletedAt !== null)) throw new ConvexError("Saved view not found.");
  return { view, access, ...flags };
}
export async function workspaceView(
  ctx: QueryCtx,
  view: Doc<"savedViews">,
  access: Awaited<ReturnType<typeof requireWorkspace>>
) {
  const favorite = await viewFavorite(ctx, view.workspaceId, access.user._id, view._id);
  return {
    view: { ...view, projectId: null, workspaceId: access.workspace._id },
    logo: renderedProjectLogo(view.logoProps),
    isFavorite: view.deletedAt === null && (await effectiveFavorite(ctx, favorite)),
    ...workspaceCapabilities(view, access),
  };
}
