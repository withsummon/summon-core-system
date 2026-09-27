import { descriptor } from "../assets/access";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireWorkspace } from "../identity/access";

export async function requireLogoWrite(ctx: QueryCtx, workspaceId: Id<"workspaces">, expectedRevision: number) {
  const access = await requireWorkspace(ctx, workspaceId);
  if (access.member.role !== "admin") throw new ConvexError("Only workspace administrators can change the logo.");
  if (!Number.isSafeInteger(expectedRevision) || access.workspace.metadataRevision !== expectedRevision)
    throw new ConvexError("Workspace settings changed. Reopen appearance before saving.");
  return access;
}
export function workspaceAppearance(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  return ctx.db
    .query("workspaceAppearance")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .unique();
}
export async function replaceWorkspaceLogo(
  ctx: MutationCtx,
  workspace: Doc<"workspaces">,
  assetId: Id<"assets"> | null
) {
  const appearance = await workspaceAppearance(ctx, workspace._id);
  if (appearance?.logoAssetId && appearance.logoAssetId !== assetId) {
    const previous = await ctx.db.get(appearance.logoAssetId);
    if (!previous || previous.purpose !== "workspaceLogo" || previous.workspaceId !== workspace._id)
      throw new ConvexError("Workspace logo reference is inconsistent.");
    await ctx.db.patch(previous._id, { status: "deleted", expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  }
  if (appearance) await ctx.db.patch(appearance._id, { logoAssetId: assetId });
  else await ctx.db.insert("workspaceAppearance", { workspaceId: workspace._id, logoAssetId: assetId });
  await ctx.db.patch(workspace._id, { metadataRevision: workspace.metadataRevision + 1 });
}
export async function publishWorkspaceLogo(ctx: MutationCtx, asset: Doc<"assets">) {
  if (asset.workspaceLogoRevision === undefined) throw new ConvexError("Workspace logo revision is missing.");
  const { workspace } = await requireLogoWrite(ctx, asset.workspaceId, asset.workspaceLogoRevision);
  await replaceWorkspaceLogo(ctx, workspace, asset._id);
}

export async function workspaceLogo(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  const appearance = await workspaceAppearance(ctx, workspaceId);
  const logo = appearance?.logoAssetId ? await ctx.db.get(appearance.logoAssetId) : null;
  if (logo && (logo.workspaceId !== workspaceId || logo.purpose !== "workspaceLogo" || logo.status !== "ready"))
    throw new ConvexError("Workspace logo reference is inconsistent.");
  return logo ? descriptor(logo) : null;
}
