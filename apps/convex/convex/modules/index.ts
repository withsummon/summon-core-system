import { ConvexError, v } from "convex/values";
import type { Infer } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import { mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import schema from "../schema";
import { date, text, pageBudget } from "../commercial/validation";
import { taskRichContent } from "../tasks/rich_content";
import { targetKey } from "../favorites/targets";
import { effectiveFavorite } from "../favorites/access";
import {
  moduleFields,
  moduleInput,
  moduleChanges,
  moduleStatus,
  moduleDirectoryView,
  moduleDirectoryOrder,
  moduleDirectoryFilters,
  defaultModuleFilters,
} from "./schema";
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
  args: { projectId: v.id("projects"), ...moduleFields, memberIds: v.optional(v.array(v.id("users"))) },
  handler: async (ctx, args) => {
    const { project, user } = await requireProject(ctx, args.projectId, true);
    if (!project.features?.modules) throw new ConvexError("Enable modules in project settings before creating one.");
    const data = content(args);
    await requireAvailableName(ctx, project._id, data.name);
    if (args.leadId) await requireModulePerson(ctx, project, args.leadId);
    const { memberIds = [], ...fields } = args;
    if (memberIds.length > 100) throw new ConvexError("Add at most 100 members in one operation.");
    const members = [...new Set(memberIds)];
    await Promise.all(members.map((id) => requireModulePerson(ctx, project, id)));
    const moduleId = await ctx.db.insert("modules", {
      ...fields,
      ...data,
      workspaceId: project.workspaceId,
      createdBy: user._id,
      updatedAt: Date.now(),
      deleted: false,
      archived: false,
    });
    await Promise.all(members.map((userId) => ctx.db.insert("moduleMembers", { moduleId, userId })));
    return moduleId;
  },
});
async function updateModule(
  ctx: MutationCtx,
  module: Doc<"modules">,
  project: Doc<"projects">,
  fields: Infer<typeof moduleInput>
) {
  requireEditableModule(module);
  const data = content(fields);
  await requireAvailableName(ctx, module.projectId, data.name, module._id);
  if (fields.leadId && fields.leadId !== module.leadId) {
    await requireModulePerson(ctx, project, fields.leadId);
  }
  await ctx.db.patch(module._id, {
    ...data,
    status: fields.status,
    leadId: fields.leadId,
    updatedAt: Math.max(Date.now(), module.updatedAt + 1),
  });
}
export const update = mutation({
  args: { moduleId: v.id("modules"), expectedUpdatedAt: v.number(), ...moduleFields },
  handler: async (ctx, args) => {
    const { module, project } = await requireModule(ctx, args.moduleId, true);
    requireModuleRevision(module, args.expectedUpdatedAt);
    await updateModule(ctx, module, project, args);
  },
});
export const patch = mutation({
  args: { moduleId: v.id("modules"), expectedUpdatedAt: v.number(), changes: moduleChanges },
  handler: async (ctx, args) => {
    const { module, project } = await requireModule(ctx, args.moduleId, true);
    requireModuleRevision(module, args.expectedUpdatedAt);
    await updateModule(ctx, module, project, { ...module, ...args.changes });
  },
});
async function detail(ctx: QueryCtx, moduleId: Id<"modules">) {
  const { module, ...access } = await requireModule(ctx, moduleId, false, true);
  return moduleDetail(ctx, module, access);
}
async function moduleDetail(
  ctx: QueryCtx,
  module: Doc<"modules">,
  { user, member, projectMember }: Awaited<ReturnType<typeof requireProject>>
) {
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
export const address = query({
  args: { projectId: v.id("projects"), moduleId: v.string() },
  handler: async (ctx, args) => {
    const access = await requireProject(ctx, args.projectId);
    const moduleId = ctx.db.normalizeId("modules", args.moduleId);
    const module = moduleId ? await ctx.db.get(moduleId) : null;
    if (!module || module.projectId !== access.project._id || module.workspaceId !== access.project.workspaceId)
      return null;
    return moduleDetail(ctx, module, access);
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
export const catalogue = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const { member, projectMember } = await requireProject(ctx, args.projectId);
    return {
      statuses: moduleStatus.members.map((status) => status.value),
      orders: moduleDirectoryOrder.members.map((order) => order.value),
      filters: defaultModuleFilters,
      canWrite: member.role !== "guest" && projectMember.role !== "guest",
    };
  },
});
function matchesDates(value: string | null, after: string | null, before: string | null) {
  return (!after || (value !== null && value >= after)) && (!before || (value !== null && value <= before));
}
async function matchesDirectory(ctx: QueryCtx, module: Doc<"modules">, filters: Infer<typeof moduleDirectoryFilters>) {
  if (filters.search && !module.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
  if (filters.statuses.length && !filters.statuses.includes(module.status)) return false;
  if (filters.leadIds.length && (!module.leadId || !filters.leadIds.includes(module.leadId))) return false;
  if (!matchesDates(module.startDate, filters.startAfter, filters.startBefore)) return false;
  if (!matchesDates(module.targetDate, filters.targetAfter, filters.targetBefore)) return false;
  if (!filters.memberIds.length) return true;
  const members = await Promise.all(
    filters.memberIds.map((userId) =>
      ctx.db
        .query("moduleMembers")
        .withIndex("by_module_user", (q) => q.eq("moduleId", module._id).eq("userId", userId))
        .unique()
    )
  );
  return members.some((member) => member !== null);
}
export const directory = query({
  args: {
    projectId: v.id("projects"),
    view: moduleDirectoryView,
    order: moduleDirectoryOrder,
    filters: moduleDirectoryFilters,
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireProject(ctx, args.projectId);
    if (args.filters.search.length > 255 || args.filters.leadIds.length > 100 || args.filters.memberIds.length > 100)
      throw new ConvexError("Narrow the module filters.");
    const filters = {
      ...args.filters,
      search: text(args.filters.search, "Search", 255),
      startAfter: date(args.filters.startAfter),
      startBefore: date(args.filters.startBefore),
      targetAfter: date(args.filters.targetAfter),
      targetBefore: date(args.filters.targetBefore),
    };
    const deleted = args.view === "trash";
    const rows = stream(ctx.db, schema).query("modules");
    const scoped =
      args.order === "name"
        ? rows.withIndex("by_project_name", (q) => q.eq("projectId", args.projectId).eq("deleted", deleted))
        : args.order === "target_date"
          ? rows.withIndex("by_project_due", (q) => q.eq("projectId", args.projectId).eq("deleted", deleted))
          : rows.withIndex("by_project", (q) => q.eq("projectId", args.projectId).eq("deleted", deleted));
    return scoped
      .order(args.order === "created_at" ? "desc" : "asc")
      .filterWith(async (module) => {
        if (args.view !== "trash" && module.archived !== (args.view === "archived")) return false;
        if (!(await matchesDirectory(ctx, module, filters))) return false;
        if (filters.favorites) {
          if (access.member.role === "guest") return false;
          const favorite = await ctx.db
            .query("favorites")
            .withIndex("by_owner_target", (q) =>
              q
                .eq("workspaceId", module.workspaceId)
                .eq("userId", access.user._id)
                .eq("targetKey", targetKey({ type: "module", id: module._id }))
            )
            .unique();
          if (!(await effectiveFavorite(ctx, favorite))) return false;
        }
        return true;
      })
      .map(async (module) => moduleDetail(ctx, module, access))
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
