import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
export function validateSequence(sequence: number) {
  if (!Number.isFinite(sequence) || Math.abs(sequence) > Number.MAX_SAFE_INTEGER)
    throw new ConvexError("Favorite order must be a finite safe number.");
}
export async function insertFavorite(
  ctx: MutationCtx,
  fields: Pick<Doc<"favorites">, "workspaceId" | "userId" | "target" | "targetProjectId" | "name" | "parentId">
) {
  const sequence = await nextSequence(ctx, fields);
  const project = fields.targetProjectId === null ? null : await ctx.db.get(fields.targetProjectId);
  if (fields.targetProjectId !== null && (!project || project.workspaceId !== fields.workspaceId))
    throw new ConvexError("Favorite project is unavailable.");
  return ctx.db.insert("favorites", {
    ...fields,
    ...(project ? { projectRevision: project.metadataRevision } : {}),
    targetType: fields.target.type,
    targetKey: fields.target.type === "folder" ? null : `${fields.target.type}:${fields.target.id}`,
    sequence,
    height: 1,
    favoritedAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
  });
}

export async function changeFavoriteDeleted(ctx: MutationCtx, row: Doc<"favorites">, deleted: boolean) {
  const updatedAt = Math.max(Date.now(), row.updatedAt + 1);
  const project = !deleted && row.targetProjectId !== null ? await ctx.db.get(row.targetProjectId) : null;
  if (!deleted && row.targetProjectId !== null && (!project || project.workspaceId !== row.workspaceId))
    throw new ConvexError("Favorite project is unavailable.");
  await ctx.db.patch(row._id, {
    deletedAt: deleted ? updatedAt : null,
    ...(project ? { projectRevision: project.metadataRevision } : {}),
    favoritedAt: deleted ? row.favoritedAt : updatedAt,
    updatedAt,
  });
}

export async function nextSequence(
  ctx: MutationCtx,
  fields: Pick<Doc<"favorites">, "workspaceId" | "userId" | "parentId">
) {
  const last = await ctx.db
    .query("favorites")
    .withIndex("by_owner_parent_order", (q) =>
      q.eq("workspaceId", fields.workspaceId).eq("userId", fields.userId).eq("parentId", fields.parentId)
    )
    .order("desc")
    .first();
  const sequence = last ? last.sequence + 10000 : 65535;
  validateSequence(sequence);
  return sequence;
}
