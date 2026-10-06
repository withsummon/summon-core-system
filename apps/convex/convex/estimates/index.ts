import { apiIdSchema } from "../identity/schema";
import type { Id } from "../_generated/dataModel";
import { compareValues, ConvexError, v, type Infer } from "convex/values";
import { z } from "zod";
import { internalMutation, query, mutation, type MutationCtx } from "../_generated/server";
import { requireProject } from "../identity/access";
import { estimateTables, systemFields, pointFields, pointInput } from "./schema";
import { estimateConfig, requireSystem, checkEstimateRevision } from "./access";
function details(name: string, description: string) {
  if (!name.trim() || name.length > 255 || description.length > 20000)
    throw new ConvexError("Enter a name up to 255 and description up to 20,000 characters.");
  return { name: name.trim(), description };
}
export function pointContent(fields: Infer<typeof pointInput>) {
  const description = fields.description ?? "";
  if (
    !Number.isSafeInteger(fields.key) ||
    fields.key < 0 ||
    !fields.value.trim() ||
    fields.value.length > 20 ||
    description.length > 20000
  )
    throw new ConvexError(
      "Points require a nonnegative integer key, value up to 20 and description up to 20,000 characters."
    );
  return { ...fields, description };
}
function validatePointValues(type: Infer<typeof systemFields.type>, points: Infer<typeof pointInput>[]) {
  const values = points.map((point) => point.value);
  const parsed =
    type === "points"
      ? z.array(z.coerce.number().positive().finite()).safeParse(values)
      : z
          .array(
            z
              .string()
              .trim()
              .min(1)
              .refine((value) => Number.isNaN(Number(value)))
          )
          .safeParse(values);
  if (!parsed.success)
    throw new ConvexError(
      type === "points" ? "Points require positive finite numbers." : "Categories require nonnumeric names."
    );
  if (new Set<string | number>(parsed.data).size !== points.length)
    throw new ConvexError("Estimate values must be unique.");
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
      types: systemFields.type.members.map((type) => type.value),
      systems: systems.filter((row) => !row.deleted),
      config: await estimateConfig(ctx, args.projectId),
      canWrite: permission.member.role !== "guest" && permission.projectMember.role !== "guest",
      canSelect:
        permission.member.role === "admin" ||
        (permission.member.role !== "guest" && permission.projectMember.role === "admin"),
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
  args: {
    projectId: v.id("projects"),
    ...systemFields,
    points: v.array(pointInput),
    rememberSelection: v.optional(v.object({ expectedRevision: v.number() })),
  },
  handler: async (ctx, args) => {
    const { project, projectMember, member } = await requireProject(ctx, args.projectId, true);
    const config = await estimateConfig(ctx, project._id);
    if (config?.jobId) throw new ConvexError("Finish the estimate replacement first.");
    if (args.rememberSelection) {
      if (member.role !== "admin" && projectMember.role !== "admin")
        throw new ConvexError("Only project administrators can select the estimate system.");
      checkEstimateRevision(config?.revision ?? 0, args.rememberSelection.expectedRevision);
    }
    const systems = await ctx.db
      .query("estimateSystems")
      .withIndex("by_project", (q) => q.eq("projectId", project._id).eq("deleted", false))
      .take(101);
    if (systems.length >= 100) throw new ConvexError("A project supports at most 100 estimate systems.");
    const fields = details(args.name, args.description);
    if (systems.some((row) => !row.deleted && row.name === fields.name))
      throw new ConvexError("Estimate system name already exists.");
    if (!args.points.length || args.points.length > 100) throw new ConvexError("Choose 1–100 estimate points.");
    const points = args.points.map(pointContent);
    validatePointValues(args.type, points);
    const systemId = await ctx.db.insert("estimateSystems", {
      apiId: await allocateEstimateSystemApiId(ctx),
      ...fields,
      type: args.type,
      workspaceId: project.workspaceId,
      projectId: project._id,
      revision: 0,
      deleted: false,
      retiring: false,
    });
    for (const point of points) {
      // Sequential inserts make the indexed UUID check observe earlier allocations in this transaction.
      // oxlint-disable-next-line no-await-in-loop
      const apiId = await allocateEstimatePointApiId(ctx);
      // oxlint-disable-next-line no-await-in-loop
      await ctx.db.insert("estimatePoints", {
        apiId,
        ...point,
        systemId,
        projectId: project._id,
        revision: 0,
        deleted: false,
        retiring: false,
      });
    }
    if (args.rememberSelection) {
      if (config) await ctx.db.patch(config._id, { lastUsedSystemId: systemId, revision: config.revision + 1 });
      else
        await ctx.db.insert("projectEstimates", {
          projectId: project._id,
          activeSystemId: null,
          lastUsedSystemId: systemId,
          revision: 1,
          jobId: null,
        });
    }
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
    const points = await ctx.db
      .query("estimatePoints")
      .withIndex("by_system", (q) => q.eq("systemId", system._id).eq("deleted", false))
      .take(101);
    validatePointValues(args.type, points);
    await ctx.db.patch(system._id, { ...fields, type: args.type, revision: system.revision + 1 });
  },
});
// Both REST and native settings select the same current configuration. The
// native settings caller supplies its reviewed revision; REST PATCH has no ETag.
export async function selectEstimateSystem(
  ctx: MutationCtx,
  permission: Awaited<ReturnType<typeof requireProject>>,
  systemId: Id<"estimateSystems"> | null,
  expectedRevision?: number
) {
  const { project, member, projectMember } = permission;
  if (member.role !== "admin" && (member.role === "guest" || projectMember.role !== "admin"))
    throw new ConvexError("Only project administrators can select the estimate system.");
  const config = await estimateConfig(ctx, project._id);
  if (expectedRevision !== undefined) checkEstimateRevision(config?.revision ?? 0, expectedRevision);
  if (config?.jobId) throw new ConvexError("Finish the estimate replacement first.");
  if (systemId !== null) {
    const system = await ctx.db.get(systemId);
    if (!system || system.deleted || system.projectId !== project._id || system.workspaceId !== project.workspaceId)
      throw new ConvexError("Estimate system belongs to another project or is unavailable.");
    if (system.retiring) throw new ConvexError("Finish the estimate replacement first.");
  }
  if (config)
    await ctx.db.patch(config._id, {
      activeSystemId: systemId,
      lastUsedSystemId: systemId ?? config.lastUsedSystemId,
      revision: config.revision + 1,
    });
  else
    await ctx.db.insert("projectEstimates", {
      projectId: project._id,
      activeSystemId: systemId,
      lastUsedSystemId: systemId,
      revision: 1,
      jobId: null,
    });
}
export const select = mutation({
  args: {
    projectId: v.id("projects"),
    systemId: v.union(v.id("estimateSystems"), v.null()),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) =>
    selectEstimateSystem(ctx, await requireProject(ctx, args.projectId), args.systemId, args.expectedRevision),
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
    validatePointValues(system.type, [...rows, fields]);
    const id = await ctx.db.insert("estimatePoints", {
      apiId: await allocateEstimatePointApiId(ctx),
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
    const rows = await ctx.db
      .query("estimatePoints")
      .withIndex("by_system", (q) => q.eq("systemId", system._id).eq("deleted", false))
      .take(101);
    validatePointValues(system.type, [...rows.filter((row) => row._id !== pointId), fields]);
    await ctx.db.patch(pointId, { ...fields, revision: point.revision + 1 });
    await ctx.db.patch(system._id, { revision: system.revision + 1 });
  },
});

async function allocateEstimateSystemApiId(ctx: MutationCtx) {
  const apiId = apiIdSchema.parse(crypto.randomUUID());
  const existing = await ctx.db
    .query("estimateSystems")
    .withIndex("by_api_id", (q) => q.eq("apiId", apiId))
    .unique();
  if (existing) throw new ConvexError("Estimate API identifier already exists.");
  return apiId;
}

async function allocateEstimatePointApiId(ctx: MutationCtx) {
  const apiId = apiIdSchema.parse(crypto.randomUUID());
  const existing = await ctx.db
    .query("estimatePoints")
    .withIndex("by_api_id", (q) => q.eq("apiId", apiId))
    .unique();
  if (existing) throw new ConvexError("Estimate point API identifier already exists.");
  return apiId;
}

// Temporary internal owner: removed after full coverage and required-field activation.
export const adoptPointApiIdentity = internalMutation({
  args: {
    expected: v.array(
      v.object({
        ...estimateTables.estimatePoints.validator.fields,
        _id: v.id("estimatePoints"),
        _creationTime: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    if (args.expected.length < 1 || args.expected.length > 20)
      throw new ConvexError("Adopt between 1 and 20 exact estimate point preimages.");
    const changes = [];
    // Each UUID allocation sees preceding row writes in this transaction.
    /* oxlint-disable no-await-in-loop */
    for (const expected of args.expected) {
      const current = await ctx.db.get(expected._id);
      if (!current || compareValues(current, expected) !== 0)
        throw new ConvexError("Estimate point changed. Capture its current preimage before adoption.");
      if (current.apiId !== undefined) continue;
      const system = await ctx.db.get(current.systemId);
      const project = await ctx.db.get(current.projectId);
      if (
        !system ||
        !project ||
        system.projectId !== project._id ||
        system.workspaceId !== project.workspaceId ||
        !(await ctx.db.get(project.workspaceId))
      )
        throw new ConvexError("Estimate point scope is inconsistent.");
      await ctx.db.patch(current._id, { apiId: await allocateEstimatePointApiId(ctx) });
      changes.push({ before: current, after: await ctx.db.get(current._id) });
    }
    /* oxlint-enable no-await-in-loop */
    return changes;
  },
});
