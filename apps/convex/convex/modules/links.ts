import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { pageBudget } from "../commercial/validation";
import { linkUrl, linkTitle, linkMetadata } from "../quickLinks/validation";
import { requireModule, requireEditableModule } from "./access";

async function uniqueUrl(ctx: QueryCtx, moduleId: Id<"modules">, url: string, except?: Id<"moduleLinks">) {
  const existing = await ctx.db
    .query("moduleLinks")
    .withIndex("by_module_url", (q) => q.eq("moduleId", moduleId).eq("url", url).eq("deletedAt", null))
    .unique();
  if (existing && existing._id !== except) throw new ConvexError("URL already exists for this module.");
}
async function writableLink(
  ctx: QueryCtx,
  moduleId: Id<"modules">,
  linkId: Id<"moduleLinks">,
  expectedUpdatedAt: number
) {
  const access = await requireModule(ctx, moduleId, true);
  requireEditableModule(access.module);
  const link = await ctx.db.get(linkId);
  if (!link || link.deletedAt !== null || link.moduleId !== moduleId) throw new ConvexError("Module link not found.");
  if (!Number.isSafeInteger(expectedUpdatedAt) || link.updatedAt !== expectedUpdatedAt)
    throw new ConvexError("This link changed. Reopen it before saving.");
  return { ...access, link };
}
export const list = query({
  args: { moduleId: v.id("modules"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireModule(ctx, args.moduleId);
    return ctx.db
      .query("moduleLinks")
      .withIndex("by_module", (q) => q.eq("moduleId", args.moduleId).eq("deletedAt", null))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
  },
});
const fields = { url: v.string(), title: v.union(v.string(), v.null()), metadata: v.any() };
function content(args: { url: string; title: string | null; metadata: unknown }) {
  const metadata = linkMetadata(args.metadata);
  if (JSON.stringify(metadata).length > 10000)
    throw new ConvexError("Link metadata must be at most 10,000 characters.");
  return { url: linkUrl(args.url), title: linkTitle(args.title), metadata };
}
export const create = mutation({
  args: { moduleId: v.id("modules"), ...fields },
  handler: async (ctx, args) => {
    const { module, user } = await requireModule(ctx, args.moduleId, true);
    requireEditableModule(module);
    const data = content(args);
    await uniqueUrl(ctx, module._id, data.url);
    const id = await ctx.db.insert("moduleLinks", {
      moduleId: module._id,
      ...data,
      deletedAt: null,
      createdBy: user._id,
      updatedBy: user._id,
      updatedAt: Date.now(),
    });
    await ctx.db.patch(module._id, { updatedBy: user._id, updatedAt: Math.max(Date.now(), module.updatedAt + 1) });
    return id;
  },
});
export const update = mutation({
  args: { moduleId: v.id("modules"), linkId: v.id("moduleLinks"), expectedUpdatedAt: v.number(), ...fields },
  handler: async (ctx, args) => {
    const { module, user, link } = await writableLink(ctx, args.moduleId, args.linkId, args.expectedUpdatedAt);
    const data = content(args);
    await uniqueUrl(ctx, module._id, data.url, link._id);
    await ctx.db.patch(link._id, { ...data, updatedBy: user._id, updatedAt: Math.max(Date.now(), link.updatedAt + 1) });
    await ctx.db.patch(module._id, { updatedBy: user._id, updatedAt: Math.max(Date.now(), module.updatedAt + 1) });
  },
});
export const remove = mutation({
  args: { moduleId: v.id("modules"), linkId: v.id("moduleLinks"), expectedUpdatedAt: v.number() },
  handler: async (ctx, args) => {
    const { module, user, link } = await writableLink(ctx, args.moduleId, args.linkId, args.expectedUpdatedAt);
    await ctx.db.patch(link._id, {
      deletedAt: Date.now(),
      updatedAt: Math.max(Date.now(), link.updatedAt + 1),
      updatedBy: user._id,
    });
    await ctx.db.patch(module._id, { updatedBy: user._id, updatedAt: Math.max(Date.now(), module.updatedAt + 1) });
  },
});
