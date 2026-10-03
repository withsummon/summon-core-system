import { defaultTemplates } from "./defaults";
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { requireWorkspace } from "../identity/access";
import { text, pageBudget } from "../commercial/validation";
import { templateFields } from "./schema";
export const save = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    templateId: v.optional(v.id("automationTemplates")),
    expectedRevision: v.optional(v.number()),
    ...templateFields,
  },
  handler: async (ctx, { workspaceId, templateId, expectedRevision, ...data }) => {
    await requireWorkspace(ctx, workspaceId, true);
    const name = text(data.name, "Template name", 255, true);
    data.type = text(data.type, "Template type", 80, true);
    data.description = text(data.description, "Description", 10000);
    data.contentTemplate = text(data.contentTemplate, "Template instructions", 30000, true);
    data.variables = data.variables.map((value) => text(value, "Variable name", 100, true));
    if (data.variables.length > 100 || new Set(data.variables).size !== data.variables.length)
      throw new ConvexError("Choose up to 100 distinct variable names.");
    const existing = templateId ? await ctx.db.get(templateId) : null;
    if (templateId && (!existing || existing.deleted || existing.workspaceId !== workspaceId))
      throw new ConvexError("Template not found.");
    if (existing && expectedRevision !== existing.revision)
      throw new ConvexError("Template changed. Reopen before saving.");
    const duplicate = await ctx.db
      .query("automationTemplates")
      .withIndex("by_name", (q) => q.eq("workspaceId", workspaceId).eq("name", name).eq("deleted", false))
      .unique();
    if (duplicate && duplicate._id !== templateId) throw new ConvexError("A template with this name already exists.");
    if (existing) {
      await ctx.db.patch(existing._id, { ...data, name, revision: existing.revision + 1 });
      return existing._id;
    }
    return ctx.db.insert("automationTemplates", {
      workspaceId,
      ...data,
      name,
      revision: 0,
      deleted: false,
      systemKey: null,
    });
  },
});
export const list = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId);
    return ctx.db
      .query("automationTemplates")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId).eq("deleted", false))
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const get = query({
  args: { templateId: v.id("automationTemplates") },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template || template.deleted) throw new ConvexError("Template not found.");
    await requireWorkspace(ctx, template.workspaceId);
    return template;
  },
});
export const remove = mutation({
  args: { templateId: v.id("automationTemplates"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template || template.deleted) throw new ConvexError("Template not found.");
    await requireWorkspace(ctx, template.workspaceId, true);
    if (template.revision !== args.expectedRevision) throw new ConvexError("Template changed. Reopen before deleting.");
    await ctx.db.patch(template._id, { deleted: true, isActive: false, revision: template.revision + 1 });
  },
});

export const installDefaults = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    await requireWorkspace(ctx, workspaceId, true);
    return ensureDefaultTemplates(ctx, workspaceId);
  },
});

export async function ensureDefaultTemplates(ctx: MutationCtx, workspaceId: Id<"workspaces">) {
  const added = await Promise.all(
    defaultTemplates.map(async (template) => {
      const existing = await ctx.db
        .query("automationTemplates")
        .withIndex("by_system_key", (q) => q.eq("workspaceId", workspaceId).eq("systemKey", template.type))
        .unique();
      const named = await ctx.db
        .query("automationTemplates")
        .withIndex("by_name", (q) => q.eq("workspaceId", workspaceId).eq("name", template.name).eq("deleted", false))
        .unique();
      if (existing || named) return null;
      return ctx.db.insert("automationTemplates", {
        workspaceId,
        ...template,
        revision: 0,
        deleted: false,
        systemKey: template.type,
      });
    })
  );
  return { created: added.filter((id) => id !== null).length };
}
