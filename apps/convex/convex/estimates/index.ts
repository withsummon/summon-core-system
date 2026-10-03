import { ConvexError, v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { requireProject } from "../identity/access";
import { systemFields, pointFields } from "./schema";
import { estimateConfig, requireSystem, checkEstimateRevision } from "./access";
function details(name: string, description: string) {
  if (!name.trim() || name.length > 255 || description.length > 20000)
    throw new ConvexError("Enter a name up to 255 and description up to 20,000 characters.");
  return { name: name.trim(), description };
}
export function pointContent(fields: { key: number; value: string; description: string }) {
  if (
    !Number.isSafeInteger(fields.key) ||
    fields.key < 0 ||
    !fields.value.trim() ||
    fields.value.length > 20 ||
    fields.description.length > 20000
  )
    throw new ConvexError(
      "Points require a nonnegative integer key, value up to 20 and description up to 20,000 characters."
    );
  return fields;
}
export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const permission = await requireProject(ctx, args.projectId);
    const systems = await ctx.db
      .query("estimateSystems")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId).eq("deleted", false))
      .take(101);
    return {
      systems: systems.filter((row) => !row.deleted),
      config: await estimateConfig(ctx, args.projectId),
      canWrite: permission.member.role !== "guest" && permission.projectMember.role !== "guest",
      canSelect: permission.member.role !== "guest" && permission.projectMember.role === "admin",
    };
  },
});
export const get = query({
  args: { systemId: v.id("estimateSystems") },
  handler: async (ctx, args) => {
    const { system } = await requireSystem(ctx, args.systemId);
    const points = await ctx.db
      .query("estimatePoints")
      .withIndex("by_system", (q) => q.eq("systemId", system._id).eq("deleted", false))
      .take(101);
    // ES2022 callers compile this owner too; sorting this fresh array cannot mutate database rows.
    // eslint-disable-next-line unicorn/no-array-sort
    return { ...system, points: points.filter((point) => !point.deleted).sort((a, b) => a.key - b.key) };
  },
});
export const create = mutation({
  args: { projectId: v.id("projects"), ...systemFields, points: v.array(v.object(pointFields)) },
  handler: async (ctx, args) => {
    const { project } = await requireProject(ctx, args.projectId, true);
    const config = await estimateConfig(ctx, project._id);
    if (config?.jobId) throw new ConvexError("Finish the estimate replacement first.");
    const systems = await ctx.db
      .query("estimateSystems")
      .withIndex("by_project", (q) => q.eq("projectId", project._id).eq("deleted", false))
      .take(101);
    if (systems.length >= 100) throw new ConvexError("A project supports at most 100 estimate systems.");
    const fields = details(args.name, args.description);
    if (systems.some((row) => !row.deleted && row.name === fields.name))
      throw new ConvexError("Estimate system name already exists.");
    if (!args.points.length || args.points.length > 100) throw new ConvexError("Choose 1–100 estimate points.");
    args.points.forEach(pointContent);
    const systemId = await ctx.db.insert("estimateSystems", {
      ...fields,
      type: args.type,
      workspaceId: project.workspaceId,
      projectId: project._id,
      revision: 0,
      deleted: false,
      retiring: false,
    });
    await Promise.all(
      args.points.map((point) =>
        ctx.db.insert("estimatePoints", {
          ...point,
          systemId,
          projectId: project._id,
          revision: 0,
          deleted: false,
          retiring: false,
        })
      )
    );
    return systemId;
  },
});
export const update = mutation({
  args: { systemId: v.id("estimateSystems"), expectedRevision: v.number(), ...systemFields },
  handler: async (ctx, args) => {
    const { system } = await requireSystem(ctx, args.systemId, true);
    checkEstimateRevision(system.revision, args.expectedRevision);
    const fields = details(args.name, args.description);
    const others = await ctx.db
      .query("estimateSystems")
      .withIndex("by_project", (q) => q.eq("projectId", system.projectId).eq("deleted", false))
      .take(101);
    if (others.some((row) => !row.deleted && row._id !== system._id && row.name === fields.name))
      throw new ConvexError("Estimate system name already exists.");
    await ctx.db.patch(system._id, { ...fields, type: args.type, revision: system.revision + 1 });
  },
});
export const select = mutation({
  args: {
    projectId: v.id("projects"),
    systemId: v.union(v.id("estimateSystems"), v.null()),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const permission = await requireProject(ctx, args.projectId, true);
    if (permission.projectMember.role !== "admin")
      throw new ConvexError("Only project administrators can select the estimate system.");
    const config = await estimateConfig(ctx, args.projectId);
    checkEstimateRevision(config?.revision ?? 0, args.expectedRevision);
    if (config?.jobId) throw new ConvexError("Finish the estimate replacement first.");
    if (args.systemId) {
      const { system } = await requireSystem(ctx, args.systemId, true);
      if (system.projectId !== args.projectId) throw new ConvexError("Estimate system belongs to another project.");
    }
    if (config) await ctx.db.patch(config._id, { activeSystemId: args.systemId, revision: config.revision + 1 });
    else
      await ctx.db.insert("projectEstimates", {
        projectId: args.projectId,
        activeSystemId: args.systemId,
        revision: 1,
        jobId: null,
      });
  },
});
export const createPoint = mutation({
  args: { systemId: v.id("estimateSystems"), expectedSystemRevision: v.number(), ...pointFields },
  handler: async (ctx, args) => {
    const { system } = await requireSystem(ctx, args.systemId, true);
    checkEstimateRevision(system.revision, args.expectedSystemRevision);
    const rows = await ctx.db
      .query("estimatePoints")
      .withIndex("by_system", (q) => q.eq("systemId", system._id).eq("deleted", false))
      .take(101);
    if (rows.length >= 100) throw new ConvexError("An estimate system supports at most 100 points.");
    const { systemId, expectedSystemRevision, ...fields } = args;
    pointContent(fields);
    const id = await ctx.db.insert("estimatePoints", {
      ...fields,
      systemId,
      projectId: system.projectId,
      revision: 0,
      deleted: false,
      retiring: false,
    });
    await ctx.db.patch(systemId, { revision: system.revision + 1 });
    return id;
  },
});
export const updatePoint = mutation({
  args: { pointId: v.id("estimatePoints"), expectedRevision: v.number(), ...pointFields },
  handler: async (ctx, args) => {
    const point = await ctx.db.get(args.pointId);
    if (!point || point.deleted) throw new ConvexError("Estimate point not found.");
    const { system } = await requireSystem(ctx, point.systemId, true);
    checkEstimateRevision(point.revision, args.expectedRevision);
    const { pointId, expectedRevision, ...fields } = args;
    pointContent(fields);
    await ctx.db.patch(pointId, { ...fields, revision: point.revision + 1 });
    await ctx.db.patch(system._id, { revision: system.revision + 1 });
  },
});
