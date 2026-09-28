import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { action, internalQuery, mutation, query } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { requireUser, requireWorkspace } from "../identity/access";
import { descriptor } from "../assets/access";
import { prepareAsset } from "../assets/index";
import { supportedAssetTypes, assetSizeLimit } from "../assets/content";
import { fileMetadataFields } from "../assets/schema";
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
    ...fileMetadataFields,
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
    return replaceWorkspaceLogo(ctx, workspace, null);
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
    const receipt = await replaceWorkspaceLogo(ctx, workspace, asset._id);
    await ctx.db.patch(asset._id, { status: "ready" });
    return receipt;
  },
});

export const receipt = internalQuery({
  args: { assetId: v.id("assets") },
  handler: async (ctx, { assetId }) => {
    const user = await requireUser(ctx);
    const asset = await ctx.db.get(assetId);
    if (
      !asset ||
      asset.purpose !== "workspaceLogo" ||
      asset.createdBy !== user._id ||
      asset.workspaceLogoRevision === undefined
    )
      throw new ConvexError("Workspace logo upload not found.");
    return {
      assetId: asset._id,
      startingRevision: asset.workspaceLogoRevision,
      revision: asset.workspaceLogoPublishedRevision ?? null,
    };
  },
});

export const finalize = action({
  args: { assetId: v.id("assets"), storageId: v.string() },
  handler: async (ctx, args): Promise<Awaited<ReturnType<typeof replaceWorkspaceLogo>> & { assetId: Id<"assets"> }> => {
    await ctx.runQuery(internal.settings.logo.receipt, { assetId: args.assetId });
    await ctx.runAction(api.assets.upload.finalize, args);
    const result = await ctx.runQuery(internal.settings.logo.receipt, { assetId: args.assetId });
    if (result.revision === null) throw new ConvexError("This upload has no workspace acknowledgement.");
    return { ...result, revision: result.revision };
  },
});
