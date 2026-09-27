import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import { date, text, pageBudget } from "../commercial/validation";
import { taskRichContent } from "../tasks/rich_content";
import { moduleFields } from "./schema";
import {
  requireModule,
  requireModuleRevision,
  requireEditableModule,
  requireAvailableName,
  requireModulePerson,
} from "./access";
function content(args: { name: string; descriptionHtml: string; startDate: string | null; targetDate: string | null }) {
  const startDate = date(args.startDate),
    targetDate = date(args.targetDate);
  if (startDate && targetDate && startDate > targetDate) throw new ConvexError("Start date cannot exceed target date.");
  const rich = taskRichContent(args.descriptionHtml);
  return {
    name: text(args.name, "Name", 255, true),
    descriptionHtml: rich.html,
    description: rich.description,
    startDate,
    targetDate,
  };
}
export const create = mutation({
  args: { projectId: v.id("projects"), ...moduleFields },
  handler: async (ctx, args) => {
    const { project, user } = await requireProject(ctx, args.projectId, true);
    const data = content(args);
    await requireAvailableName(ctx, project._id, data.name);
    if (args.leadId) await requireModulePerson(ctx, project, args.leadId);
    return ctx.db.insert("modules", {
      ...args,
      ...data,
      workspaceId: project.workspaceId,
      createdBy: user._id,
      updatedAt: Date.now(),
      deleted: false,
      archived: false,
    });
  },
});
export const update = mutation({
  args: { moduleId: v.id("modules"), expectedUpdatedAt: v.number(), ...moduleFields },
  handler: async (ctx, args) => {
    const { module, project } = await requireModule(ctx, args.moduleId, true);
    requireModuleRevision(module, args.expectedUpdatedAt);
    requireEditableModule(module);
    const data = content(args);
    await requireAvailableName(ctx, project._id, data.name, module._id);
    if (args.leadId && args.leadId !== module.leadId) await requireModulePerson(ctx, project, args.leadId);
    await ctx.db.patch(module._id, {
      ...data,
      status: args.status,
      leadId: args.leadId,
      updatedAt: Math.max(Date.now(), module.updatedAt + 1),
    });
  },
});
async function detail(ctx: QueryCtx, moduleId: Id<"modules">) {
  const { module, user, member, projectMember } = await requireModule(ctx, moduleId, false, true);
  const canWrite = member.role !== "guest" && projectMember.role !== "guest";
  const lead = module.leadId ? await ctx.db.get(module.leadId) : null;
  return {
    ...module,
    lead: lead ? { id: lead._id, name: lead.name ?? null, email: lead.email ?? null } : null,
    canWrite,
    canEdit: canWrite && !module.archived && !module.deleted,
    canDelete: canWrite && (module.createdBy === user._id || projectMember.role === "admin"),
  };
}
export const get = query({
  args: { moduleId: v.id("modules") },
  handler: (ctx, args) => detail(ctx, args.moduleId),
});
export const resolve = query({
  args: { moduleId: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("modules", args.moduleId);
    if (!id) throw new ConvexError("Module not found.");
    return detail(ctx, id);
  },
});
export const list = query({
  args: {
    projectId: v.id("projects"),
    deleted: v.boolean(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireProject(ctx, args.projectId);
    return ctx.db
      .query("modules")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId).eq("deleted", args.deleted))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const lifecycle = mutation({
  args: {
    moduleId: v.id("modules"),
    expectedUpdatedAt: v.number(),
    operation: v.union(v.literal("archive"), v.literal("unarchive"), v.literal("delete"), v.literal("restore")),
  },
  handler: async (ctx, args) => {
    const { module, user, projectMember } = await requireModule(ctx, args.moduleId, true, true);
    requireModuleRevision(module, args.expectedUpdatedAt);
    if (args.operation === "delete" || args.operation === "restore") {
      if (module.createdBy !== user._id && projectMember.role !== "admin")
        throw new ConvexError("Only the module creator or a project administrator can delete or restore it.");
      if (module.deleted === (args.operation === "delete")) return;
      if (args.operation === "restore") await requireAvailableName(ctx, module.projectId, module.name);
      await ctx.db.patch(module._id, {
        deleted: args.operation === "delete",
        updatedAt: Math.max(Date.now(), module.updatedAt + 1),
      });
    } else {
      if (module.deleted) throw new ConvexError("Restore this module first.");
      if (args.operation === "archive" && module.status !== "completed" && module.status !== "cancelled")
        throw new ConvexError("Only completed or cancelled modules can be archived.");
      if (module.archived === (args.operation === "archive")) return;
      await ctx.db.patch(module._id, {
        archived: args.operation === "archive",
        updatedAt: Math.max(Date.now(), module.updatedAt + 1),
      });
    }
  },
});
