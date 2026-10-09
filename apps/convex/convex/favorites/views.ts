import { changeFavoriteDeleted, insertFavorite } from "./write";
import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireWorkspace } from "../identity/access";
import { visibleTarget } from "./targets";
import { ancestors, viewFavorite, favoriteRemoved } from "./access";
// Both existing saved-view entrypoints keep their Boolean idempotent contract.
// Stored folder placement is preserved; unstar is reversible soft removal.
export async function setViewFavorite(
  ctx: MutationCtx,
  view: Doc<"savedViews">,
  userId: Id<"users">,
  favorite: boolean
) {
  const { member } = await requireWorkspace(ctx, view.workspaceId, true);
  const target = { type: "view" as const, id: view._id };
  const visible = await visibleTarget(ctx, target, member);
  if (!visible?.canFavorite) throw new ConvexError("Guests cannot change favorites.");
  const row = await viewFavorite(ctx, view.workspaceId, userId, view._id);
  if (row) {
    if (favorite && (await ancestors(ctx, row)).some((parent) => parent.deletedAt !== null))
      throw new ConvexError("Restore the parent favorite folder first.");
    if (!(await favoriteRemoved(ctx, row)) === favorite) return;
    await changeFavoriteDeleted(ctx, row, !favorite);
    return;
  }
  if (!favorite) return;
  await insertFavorite(ctx, {
    workspaceId: view.workspaceId,
    userId,
    target,
    targetProjectId: view.projectId,
    name: null,
    parentId: null,
  });
}
