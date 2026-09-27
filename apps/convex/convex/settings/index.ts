import { workspaceName, workspaceSlug } from "./metadata";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireWorkspace } from "../identity/access";
import { settingsFields } from "./schema";

import { defaultSettings, validateSettings } from "./values";
export const update = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    ...settingsFields,
    slug: v.string(),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const { member, workspace } = await requireWorkspace(ctx, args.workspaceId, true);
    if (member.role !== "admin") throw new ConvexError("Only workspace administrators can change settings.");
    const revision = workspace.metadataRevision;
    if (!Number.isSafeInteger(args.expectedRevision) || args.expectedRevision !== revision)
      throw new ConvexError("Workspace settings changed. Reopen settings before saving.");
    const name = workspaceName(args.name);
    const slug = workspaceSlug(args.slug);
    const occupied = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (occupied && occupied._id !== workspace._id) throw new ConvexError("This workspace slug is already taken.");
    const data = validateSettings(args);
    const stored = await ctx.db
      .query("workspaceSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();
    await ctx.db.patch(args.workspaceId, { name, slug, metadataRevision: revision + 1 });
    if (stored) await ctx.db.patch(stored._id, data);
    else await ctx.db.insert("workspaceSettings", { workspaceId: args.workspaceId, ...data });
    return { slug, revision: revision + 1 };
  },
});
export const metadata = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { workspace, member } = await requireWorkspace(ctx, args.workspaceId);
    const workspaceId = workspace._id;
    const stored = await ctx.db
      .query("workspaceSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .unique();
    const { organizationSize, timezone, industry, description, currency, workweek } = stored ?? defaultSettings;
    return {
      name: workspace.name,
      slug: workspace.slug,
      organizationSize,
      timezone,
      industry,
      description,
      currency,
      workweek,
      revision: workspace.metadataRevision,
      canManage: member.role === "admin",
    };
  },
});
export const slugAvailability = query({
  args: { workspaceId: v.id("workspaces"), slug: v.string() },
  handler: async (ctx, args) => {
    const { member } = await requireWorkspace(ctx, args.workspaceId);
    if (member.role !== "admin") throw new ConvexError("Only workspace administrators can check a new slug.");
    const slug = workspaceSlug(args.slug);
    const found = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    return { available: !found || found._id === args.workspaceId };
  },
});
