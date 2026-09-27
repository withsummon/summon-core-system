import { workspaceName, workspaceSlug } from "./metadata";
import type { Infer } from "convex/values";
import { DEFAULT_WORKSPACE_TIMEZONE, validateTimezone } from "./timezone";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireWorkspace } from "../identity/access";
import { text } from "../commercial/validation";
import { settingsFields } from "./schema";

const settingsValue = v.object(settingsFields);
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
function validateSettings(args: Infer<typeof settingsValue>) {
  const organizationSize = args.organizationSize === null ? null : text(args.organizationSize, "Organization size", 20);
  const industry = text(args.industry, "Industry", 120);
  const description = text(args.description, "Description", 100000);
  if (!/^[A-Z]{3}$/.test(args.currency)) throw new ConvexError("Enter a three-letter uppercase currency code.");
  if (new Set(args.workweek).size !== args.workweek.length) throw new ConvexError("Workweek days must be unique.");
  validateTimezone(args.timezone);
  return {
    organizationSize,
    industry,
    description,
    timezone: args.timezone,
    currency: args.currency,
    workweek: args.workweek,
  };
}
export const metadata = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { workspace, member } = await requireWorkspace(ctx, args.workspaceId);
    const workspaceId = workspace._id;
    const stored = await ctx.db
      .query("workspaceSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .unique();
    const defaults: Infer<typeof settingsValue> = {
      organizationSize: null,
      timezone: DEFAULT_WORKSPACE_TIMEZONE,
      industry: "",
      description: "",
      currency: "IDR",
      workweek: [],
    };
    const { organizationSize, timezone, industry, description, currency, workweek } = stored ?? defaults;
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
