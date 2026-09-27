import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireWorkspace } from "../identity/access";
import { descriptor } from "../assets/access";
import { prepareAsset } from "../assets/index";
import { supportedAssetTypes, assetSizeLimit } from "../assets/content";
import { requireLogoWrite, replaceWorkspaceLogo, workspaceAppearance, workspaceLogo } from "./logo_owner";

export const get = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const { workspace, member } = await requireWorkspace(ctx, workspaceId);
    const logo = await workspaceLogo(ctx, workspaceId);
    return {
      logo,
      revision: workspace.metadataRevision,
      canManage: member.role === "admin",
      supportedTypes: [...supportedAssetTypes].filter((type) => type.startsWith("image/")),
      maxBytes: assetSizeLimit("image/png"),
    };
  },
});
export const prepare = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    expectedRevision: v.number(),
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
    sha256: v.string(),
  },
  handler: async (ctx, { expectedRevision, ...args }) => {
    await requireLogoWrite(ctx, args.workspaceId, expectedRevision);
    if (!args.contentType.startsWith("image/"))
      throw new ConvexError("Choose a supported image for the workspace logo.");
    return prepareAsset(
      ctx,
      { ...args, projectId: null, documentId: null },
      { purpose: "workspaceLogo", workspaceLogoRevision: expectedRevision }
    );
  },
});
export const remove = mutation({
  args: { workspaceId: v.id("workspaces"), assetId: v.id("assets"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const { workspace } = await requireLogoWrite(ctx, args.workspaceId, args.expectedRevision);
    const appearance = await workspaceAppearance(ctx, workspace._id);
    if (appearance?.logoAssetId !== args.assetId) throw new ConvexError("The workspace logo changed.");
    await replaceWorkspaceLogo(ctx, workspace, null);
  },
});
export const removed = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { member } = await requireWorkspace(ctx, args.workspaceId);
    if (member.role !== "admin") throw new ConvexError("Only workspace administrators can recover logos.");
    if (
      !Number.isSafeInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 50
    )
      throw new ConvexError("Request between 1 and 50 logos.");
    const page = await ctx.db
      .query("assets")
      .withIndex("by_workspace_purpose_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("purpose", "workspaceLogo").eq("status", "deleted")
      )
      .order("desc")
      .paginate({ ...args.paginationOpts, maximumRowsRead: 100, maximumBytesRead: 1024 * 1024 });
    return {
      ...page,
      page: page.page.map((asset) => Object.assign(descriptor(asset), { recoverUntil: asset.expiresAt })),
    };
  },
});
export const restore = mutation({
  args: { workspaceId: v.id("workspaces"), assetId: v.id("assets"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const { workspace } = await requireLogoWrite(ctx, args.workspaceId, args.expectedRevision);
    const asset = await ctx.db.get(args.assetId);
    if (
      !asset ||
      asset.workspaceId !== workspace._id ||
      asset.purpose !== "workspaceLogo" ||
      asset.status !== "deleted"
    )
      throw new ConvexError("Removed workspace logo not found.");
    if (asset.expiresAt <= Date.now() || !asset.storageId || !(await ctx.db.system.get(asset.storageId)))
      throw new ConvexError("This logo can no longer be recovered.");
    await replaceWorkspaceLogo(ctx, workspace, asset._id);
    await ctx.db.patch(asset._id, { status: "ready" });
  },
});
