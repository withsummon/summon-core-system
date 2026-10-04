import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { requireNetworkScope } from "./network_access";
import { canAdministerProject } from "./administration";
import { descriptor } from "../assets/access";
import { prepareAsset } from "../assets/index";
import { fileMetadataFields } from "../assets/schema";
import { assetSizeLimit, externalCoverUrl, supportedAssetTypes } from "../assets/content";
import { pageBudget } from "../commercial/validation";
import { projectCover, requireCoverWrite, replaceProjectCover } from "./cover_owner";
export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const access = await requireNetworkScope(ctx, projectId);
    const canManage = await canAdministerProject(ctx, access.project, access.user._id, access.member.role);
    if (!canManage && !access.membership?.active) throw new ConvexError("Project not found.");
    return {
      ...(await projectCover(ctx, projectId)),
      canManage,
      supportedTypes: [...supportedAssetTypes].filter((type) => type.startsWith("image/")),
      maxBytes: assetSizeLimit("image/png"),
    };
  },
});
export const prepare = mutation({
  args: {
    projectId: v.id("projects"),
    expectedRevision: v.number(),
    ...fileMetadataFields,
  },
  handler: async (ctx, { expectedRevision, ...args }) => {
    const { project } = await requireCoverWrite(ctx, args.projectId, expectedRevision);
    if (!args.contentType.startsWith("image/"))
      throw new ConvexError("Choose a supported image for the project cover.");
    return prepareAsset(
      ctx,
      { ...args, workspaceId: project.workspaceId, documentId: null },
      { purpose: "projectCover", projectCoverRevision: expectedRevision }
    );
  },
});
export const remove = mutation({
  args: { projectId: v.id("projects"), assetId: v.id("assets"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const { appearance } = await requireCoverWrite(ctx, args.projectId, args.expectedRevision);
    if (appearance?.coverAssetId !== args.assetId) throw new ConvexError("The project cover changed.");
    await replaceProjectCover(ctx, args.projectId, appearance, null);
  },
});
export const removed = query({
  args: { projectId: v.id("projects"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const access = await requireNetworkScope(ctx, args.projectId, true);
    if (!(await canAdministerProject(ctx, access.project, access.user._id, access.member.role)))
      throw new ConvexError("Only workspace or project administrators can recover covers.");
    const page = await ctx.db
      .query("assets")
      .withIndex("by_project_purpose_status", (q) =>
        q.eq("projectId", args.projectId).eq("purpose", "projectCover").eq("status", "deleted")
      )
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    return {
      ...page,
      page: page.page.map((asset) => Object.assign(descriptor(asset), { recoverUntil: asset.expiresAt })),
    };
  },
});
export const restore = mutation({
  args: { projectId: v.id("projects"), assetId: v.id("assets"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const { project, appearance } = await requireCoverWrite(ctx, args.projectId, args.expectedRevision);
    const asset = await ctx.db.get(args.assetId);
    if (
      !asset ||
      asset.workspaceId !== project.workspaceId ||
      asset.projectId !== project._id ||
      asset.purpose !== "projectCover" ||
      asset.status !== "deleted"
    )
      throw new ConvexError("Removed project cover not found.");
    if (asset.expiresAt <= Date.now() || !asset.storageId || !(await ctx.db.system.get(asset.storageId)))
      throw new ConvexError("This cover can no longer be recovered.");
    await replaceProjectCover(ctx, project._id, appearance, asset._id);
    await ctx.db.patch(asset._id, { status: "ready" });
  },
});

export const setExternal = mutation({
  args: { projectId: v.id("projects"), expectedRevision: v.number(), url: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const { appearance } = await requireCoverWrite(ctx, args.projectId, args.expectedRevision);
    const url = externalCoverUrl(args.url);
    if (appearance) await ctx.db.patch(appearance._id, { externalCoverUrl: url, revision: appearance.revision + 1 });
    else
      await ctx.db.insert("projectAppearance", {
        projectId: args.projectId,
        coverAssetId: null,
        externalCoverUrl: url,
        revision: 1,
      });
  },
});
export const clear = mutation({
  args: { projectId: v.id("projects"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const { appearance } = await requireCoverWrite(ctx, args.projectId, args.expectedRevision);
    await replaceProjectCover(ctx, args.projectId, appearance, null, true);
  },
});
