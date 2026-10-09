import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";
import { requireWorkspace } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { linkTitle, linkUrl, linkMetadata } from "./validation";
async function requireLink(ctx: QueryCtx, workspaceId: Id<"workspaces">, linkId: Id<"quickLinks">) {
  const { user } = await requireWorkspace(ctx, workspaceId);
  const link = await ctx.db.get(linkId);
  if (!link || link.workspaceId !== workspaceId || link.ownerId !== user._id || link.deletedAt !== null)
    throw new ConvexError("Quick link not found.");
  return link;
}
async function availableUrl(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  ownerId: Id<"users">,
  url: string,
  except?: Id<"quickLinks">
) {
  const duplicate = await ctx.db
    .query("quickLinks")
    .withIndex("by_owner_url", (q) =>
      q.eq("workspaceId", workspaceId).eq("ownerId", ownerId).eq("deletedAt", null).eq("url", url)
    )
    .unique();
  if (duplicate && duplicate._id !== except) throw new ConvexError("URL already exists for this workspace and owner.");
}
function revision(link: Doc<"quickLinks">, expectedUpdatedAt: number) {
  if (!Number.isSafeInteger(expectedUpdatedAt) || link.updatedAt !== expectedUpdatedAt)
    throw new ConvexError("This quick link changed. Reload before saving.");
}
export const list = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    return ctx.db
      .query("quickLinks")
      .withIndex("by_owner", (q) => q.eq("workspaceId", args.workspaceId).eq("ownerId", user._id).eq("deletedAt", null))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const get = query({
  args: { workspaceId: v.id("workspaces"), linkId: v.id("quickLinks") },
  handler: (ctx, args) => requireLink(ctx, args.workspaceId, args.linkId),
});
export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    url: v.string(),
    title: v.optional(v.union(v.string(), v.null())),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    const url = linkUrl(args.url);
    await availableUrl(ctx, args.workspaceId, user._id, url);
    return ctx.db.insert("quickLinks", {
      workspaceId: args.workspaceId,
      ownerId: user._id,
      url,
      title: linkTitle(args.title ?? null),
      metadata: linkMetadata(args.metadata === undefined ? {} : args.metadata),
      updatedAt: Date.now(),
      deletedAt: null,
    });
  },
});
export const update = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    linkId: v.id("quickLinks"),
    expectedUpdatedAt: v.number(),
    url: v.optional(v.string()),
    title: v.optional(v.union(v.string(), v.null())),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const link = await requireLink(ctx, args.workspaceId, args.linkId);
    revision(link, args.expectedUpdatedAt);
    const url = args.url === undefined ? link.url : linkUrl(args.url);
    await availableUrl(ctx, link.workspaceId, link.ownerId, url, link._id);
    await ctx.db.patch(link._id, {
      url,
      title: args.title === undefined ? link.title : linkTitle(args.title),
      metadata: args.metadata === undefined ? link.metadata : linkMetadata(args.metadata),
      updatedAt: Math.max(Date.now(), link.updatedAt + 1),
    });
  },
});
export const remove = mutation({
  args: { workspaceId: v.id("workspaces"), linkId: v.id("quickLinks"), expectedUpdatedAt: v.number() },
  handler: async (ctx, args) => {
    const link = await requireLink(ctx, args.workspaceId, args.linkId);
    revision(link, args.expectedUpdatedAt);
    const updatedAt = Math.max(Date.now(), link.updatedAt + 1);
    await ctx.db.patch(link._id, { deletedAt: updatedAt, updatedAt });
  },
});
