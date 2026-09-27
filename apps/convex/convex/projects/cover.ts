import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { requireProject } from "../identity/access";
import { descriptor } from "../assets/access";
import { prepareAsset } from "../assets/index";
import { assetSizeLimit, supportedAssetTypes } from "../assets/content";
import { pageBudget } from "../commercial/validation";
import { projectCover, requireCoverWrite, replaceProjectCover } from "./cover_owner";
export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const access = await requireProject(ctx, projectId);
    return {
      ...(await projectCover(ctx, projectId)),
      canManage: access.member.role !== "guest" && access.projectMember.role === "admin",
      supportedTypes: [...supportedAssetTypes].filter((type) => type.startsWith("image/")),
      maxBytes: assetSizeLimit("image/png"),
    };
  },
});
export const prepare = mutation({
  args: {
    projectId: v.id("projects"),
    expectedRevision: v.number(),
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
    sha256: v.string(),
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
    const access = await requireProject(ctx, args.projectId, true);
    if (access.projectMember.role !== "admin") throw new ConvexError("Only project administrators can recover covers.");
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

function externalUrl(value: string | null) {
  if (value === null) return undefined;
  if (!value || value.length > 2048 || value !== value.trim())
    throw new ConvexError("Enter an external cover URL of at most 2048 characters.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConvexError("Enter a valid external cover URL.");
  }
  if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password)
    throw new ConvexError("Use an http or https cover URL without credentials.");
  return value;
}
export const setExternal = mutation({
  args: { projectId: v.id("projects"), expectedRevision: v.number(), url: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const { appearance } = await requireCoverWrite(ctx, args.projectId, args.expectedRevision);
    const externalCoverUrl = externalUrl(args.url);
    if (appearance) await ctx.db.patch(appearance._id, { externalCoverUrl, revision: appearance.revision + 1 });
    else
      await ctx.db.insert("projectAppearance", {
        projectId: args.projectId,
        coverAssetId: null,
        externalCoverUrl,
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
