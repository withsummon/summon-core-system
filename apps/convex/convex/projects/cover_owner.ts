import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireNetworkScope } from "./network_access";
import { canAdministerProject } from "./administration";
import { descriptor } from "../assets/access";
export function projectAppearance(ctx: QueryCtx, projectId: Id<"projects">) {
  return ctx.db
    .query("projectAppearance")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .unique();
}
export async function requireCoverWrite(ctx: QueryCtx, projectId: Id<"projects">, expectedRevision: number) {
  const access = await requireNetworkScope(ctx, projectId);
  if (!(await canAdministerProject(ctx, access.project, access.user._id, access.member.role)))
    throw new ConvexError("Only workspace or project administrators can change the cover.");
  const appearance = await projectAppearance(ctx, projectId);
  if (!Number.isSafeInteger(expectedRevision) || (appearance?.revision ?? 0) !== expectedRevision)
    throw new ConvexError("Project cover changed. Reopen appearance before saving.");
  return { ...access, appearance };
}
export async function replaceProjectCover(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  appearance: Doc<"projectAppearance"> | null,
  assetId: Id<"assets"> | null,
  clearExternal = false
) {
  if (appearance?.coverAssetId && appearance.coverAssetId !== assetId) {
    const previous = await ctx.db.get(appearance.coverAssetId);
    if (!previous || previous.purpose !== "projectCover" || previous.projectId !== projectId)
      throw new ConvexError("Project cover reference is inconsistent.");
    await ctx.db.patch(previous._id, { status: "deleted", expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  }
  if (appearance)
    await ctx.db.patch(appearance._id, {
      coverAssetId: assetId,
      revision: appearance.revision + 1,
      ...(clearExternal ? { externalCoverUrl: undefined } : {}),
    });
  else await ctx.db.insert("projectAppearance", { projectId, coverAssetId: assetId, revision: 1 });
}
export async function publishProjectCover(ctx: MutationCtx, asset: Doc<"assets">) {
  if (!asset.projectId || asset.projectCoverRevision === undefined)
    throw new ConvexError("Project cover intent is missing.");
  const { appearance } = await requireCoverWrite(ctx, asset.projectId, asset.projectCoverRevision);
  await replaceProjectCover(ctx, asset.projectId, appearance, asset._id);
}
export async function projectCover(ctx: QueryCtx, projectId: Id<"projects">) {
  const appearance = await projectAppearance(ctx, projectId);
  if (!appearance) return { cover: null, externalCoverUrl: null, revision: 0 };
  const asset = appearance.coverAssetId ? await ctx.db.get(appearance.coverAssetId) : null;
  if (asset && (asset.projectId !== projectId || asset.purpose !== "projectCover" || asset.status !== "ready"))
    throw new ConvexError("Project cover reference is inconsistent.");
  return {
    cover: asset ? descriptor(asset) : null,
    externalCoverUrl: appearance.externalCoverUrl ?? null,
    revision: appearance.revision,
  };
}
