import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireWorkspace } from "../identity/access";
import { text } from "../commercial/validation";
import { settingsFields } from "./schema";

export const get = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const { workspace } = await requireWorkspace(ctx, workspaceId);
    const stored = await ctx.db
      .query("workspaceSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .unique();
    return {
      name: workspace.name,
      slug: workspace.slug,
      organizationSize: stored?.organizationSize ?? null,
      timezone: stored?.timezone ?? "UTC",
      industry: stored?.industry ?? "",
      description: stored?.description ?? "",
      currency: stored?.currency ?? "IDR",
      workweek: stored?.workweek ?? [],
    };
  },
});

export const save = mutation({
  args: { workspaceId: v.id("workspaces"), name: v.string(), ...settingsFields },
  handler: async (ctx, args) => {
    const { member } = await requireWorkspace(ctx, args.workspaceId, true);
    if (member.role !== "admin") throw new ConvexError("Only workspace administrators can change settings.");
    const name = text(args.name, "Workspace name", 80, true);
    const organizationSize =
      args.organizationSize === null ? null : text(args.organizationSize, "Organization size", 20);
    const industry = text(args.industry, "Industry", 120);
    const description = text(args.description, "Description", 100000);
    if (!/^[A-Z]{3}$/.test(args.currency)) throw new ConvexError("Enter a three-letter uppercase currency code.");
    if (new Set(args.workweek).size !== args.workweek.length) throw new ConvexError("Workweek days must be unique.");
    try {
      new Intl.DateTimeFormat("en", { timeZone: args.timezone }).format(0);
    } catch {
      throw new ConvexError("Enter a supported IANA timezone.");
    }
    const data = {
      organizationSize,
      industry,
      description,
      timezone: args.timezone,
      currency: args.currency,
      workweek: args.workweek,
    };
    const stored = await ctx.db
      .query("workspaceSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();
    await ctx.db.patch(args.workspaceId, { name });
    if (stored) await ctx.db.patch(stored._id, data);
    else await ctx.db.insert("workspaceSettings", { workspaceId: args.workspaceId, ...data });
  },
});
