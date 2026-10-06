import { compareValues, ConvexError, v, type Infer } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { requireProject } from "../identity/access";
import { canAdministerProject } from "../projects/administration";
import { taskTables, requireTaskLabelAdopted, labelFields, labelWriteFields, allocateTaskLabelApiId } from "./schema";
import { requireLabelManagement } from "./label_access";
import { text } from "../commercial/validation";
import type { Doc, Id } from "../_generated/dataModel";
async function projectLabels(ctx: QueryCtx, projectId: Id<"projects">) {
  const rows = await ctx.db
    .query("taskLabels")
    .withIndex("by_project_order", (q) => q.eq("projectId", projectId))
    .take(1001);
  if (rows.length > 1000) throw new ConvexError("A project supports up to 1000 labels.");
  return rows.filter((row): row is typeof row & { projectId: Id<"projects"> } => row.projectId === projectId);
}
export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await requireProject(ctx, args.projectId);
    return projectLabels(ctx, args.projectId);
  },
});
export const settings = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const access = await requireProject(ctx, args.projectId);
    return {
      labels: await projectLabels(ctx, args.projectId),
      canManage:
        access.member.role !== "guest" &&
        (await canAdministerProject(ctx, access.project, access.user._id, access.member.role)),
    };
  },
});
export const save = mutation({
  args: {
    projectId: v.id("projects"),
    labelId: v.optional(v.id("taskLabels")),
    expectedRevision: v.optional(v.number()),
    change: v.union(
      v.object({
        kind: v.literal("metadata"),
        data: v.object({ name: labelFields.name, description: labelFields.description, color: labelFields.color }),
      }),
      v.object({
        kind: v.literal("position"),
        parentId: v.union(v.id("taskLabels"), v.null()),
        position: v.union(
          v.object({ targetId: v.null() }),
          v.object({
            targetId: v.id("taskLabels"),
            expectedRevision: v.number(),
            placement: v.union(v.literal("before"), v.literal("after")),
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { project, user } = await requireLabelManagement(ctx, args.projectId);
    const rows = await projectLabels(ctx, project._id);
    rows.forEach(requireTaskLabelAdopted);
    const existing = rows.find((row) => row._id === args.labelId);
    if (args.labelId && (!existing || existing.retiring))
      throw new ConvexError("Label is unavailable or being removed.");
    if (existing && args.expectedRevision !== existing.revision)
      throw new ConvexError("Label changed. Reopen its latest settings.");
    if (args.change.kind === "metadata") {
      const name = text(args.change.data.name, "Label name", 255, true),
        description = text(args.change.data.description, "Label description", 10000),
        color = text(args.change.data.color, "Label color", 255);
      if (rows.some((row) => row._id !== args.labelId && row.name.toLocaleLowerCase() === name.toLocaleLowerCase()))
        throw new ConvexError("This label name already exists.");
      const data = { name, description, color };
      if (existing)
        return writeTaskLabel(ctx, project, user, existing, {
          ...data,
          sortOrder: existing.sortOrder,
          parentId: existing.parentId,
          externalSource: existing.externalSource,
          externalId: existing.externalId,
        });
      if (rows.length >= 1000) throw new ConvexError("A project supports up to 1000 labels.");
      return writeTaskLabel(ctx, project, user, null, {
        ...data,
        sortOrder: (rows.at(-1)?.sortOrder ?? 0) + 10000,
        parentId: null,
        externalSource: null,
        externalId: null,
      });
    }
    if (!existing) throw new ConvexError("Choose an existing label to move.");
    const { parentId, position } = args.change;
    await validateLabelGroups(ctx, existing, parentId);
    if (position.targetId === null && existing.parentId === parentId) return existing._id;
    const siblings = rows.filter((row) => row._id !== existing._id && row.parentId === parentId);
    let index = siblings.length;
    if (position.targetId !== null) {
      const target = siblings.find((row) => row._id === position.targetId);
      if (!target || target.retiring || target.revision !== position.expectedRevision)
        throw new ConvexError("Target label changed. Reopen its latest settings.");
      index = siblings.indexOf(target);
      if (position.placement === "after") index++;
    }
    await Promise.all(
      siblings.map(async (row, siblingIndex) => {
        const sortOrder = (siblingIndex + (siblingIndex >= index ? 2 : 1)) * 10000;
        if (row.sortOrder !== sortOrder)
          await ctx.db.patch(row._id, {
            sortOrder,
            updatedBy: user._id,
            updatedAt: Date.now(),
            revision: row.revision + 1,
          });
      })
    );
    await ctx.db.patch(existing._id, {
      parentId,
      sortOrder: (index + 1) * 10000,
      updatedBy: user._id,
      updatedAt: Date.now(),
      revision: existing.revision + 1,
    });
    return existing._id;
  },
});

export async function validateLabelGroups(
  ctx: QueryCtx,
  existing: Doc<"taskLabels">,
  parentId: Id<"taskLabels"> | null
) {
  if (parentId === null || parentId === existing.parentId) return;
  const visited = new Set<Id<"taskLabels">>([existing._id]);
  let current: Id<"taskLabels"> | null = parentId;
  // Ancestry is sequential; every next parent belongs to the preceding row.
  /* oxlint-disable no-await-in-loop */
  while (current) {
    if (visited.has(current))
      throw new ConvexError({ status: 400, errors: { parent: ["A label cannot contain itself or its ancestors."] } });
    visited.add(current);
    if (visited.size > 20)
      throw new ConvexError({ status: 400, errors: { parent: ["Label groups support at most 20 levels."] } });
    const parent: Doc<"taskLabels"> | null = await ctx.db.get(current);
    if (
      !parent ||
      parent.retiring ||
      parent.projectId !== existing.projectId ||
      parent.workspaceId !== existing.workspaceId
    )
      throw new ConvexError({ status: 400, errors: { parent: ["Choose an active group in this project."] } });
    current = parent.parentId;
  }
  /* oxlint-enable no-await-in-loop */
}

const labelWrite = v.object(labelWriteFields);
export async function writeTaskLabel(
  ctx: MutationCtx,
  project: Doc<"projects">,
  user: Doc<"users">,
  existing: Doc<"taskLabels"> | null,
  data: Infer<typeof labelWrite>
) {
  if (data.parentId !== null && data.parentId !== existing?.parentId) {
    const parent = await ctx.db.get(data.parentId);
    if (!parent || parent.retiring)
      throw new ConvexError({ status: 400, errors: { parent: ["Invalid label reference."] } });
  }
  if (existing) {
    if (existing.projectId !== project._id || existing.workspaceId !== project.workspaceId || existing.retiring)
      throw new ConvexError("Label is unavailable or being removed.");
    await ctx.db.patch(existing._id, {
      ...data,
      updatedBy: user._id,
      updatedAt: Date.now(),
      revision: existing.revision + 1,
    });
    return existing._id;
  }
  return ctx.db.insert("taskLabels", {
    ...data,
    apiId: await allocateTaskLabelApiId(ctx),
    workspaceId: project.workspaceId,
    projectId: project._id,
    createdBy: user._id,
    updatedBy: null,
    updatedAt: Date.now(),
    revision: 0,
    retiring: false,
  });
}

// Temporary missing-only migration. Remove after complete field coverage and a
// second zero-write pass on every deployment, then require the stored fields.
export const adoptCatalogue = internalMutation({
  args: {
    expected: v.array(
      v.object({
        ...taskTables.taskLabels.validator.fields,
        _id: v.id("taskLabels"),
        _creationTime: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    if (args.expected.length < 1 || args.expected.length > 20)
      throw new ConvexError("Adopt between 1 and 20 exact Label preimages.");
    const changes = [];
    const updatedAt = Date.now();
    // Each UUID allocation sees earlier inserts; capture exact native before/after rows.
    /* oxlint-disable no-await-in-loop */
    for (const expected of args.expected) {
      const current = await ctx.db.get(expected._id);
      if (!current || compareValues(current, expected) !== 0)
        throw new ConvexError("Label changed. Capture its current preimage before adoption.");
      const fields = [
        current.apiId,
        current.createdBy,
        current.updatedBy,
        current.updatedAt,
        current.externalSource,
        current.externalId,
      ];
      if (fields.every((value) => value !== undefined)) continue;
      if (fields.some((value) => value !== undefined))
        throw new ConvexError("Partial Label adoption requires explicit review.");
      const project = current.projectId === null ? null : await ctx.db.get(current.projectId);
      if (
        (current.projectId !== null && (!project || project.workspaceId !== current.workspaceId)) ||
        !(await ctx.db.get(current.workspaceId))
      )
        throw new ConvexError("Label scope is inconsistent.");
      await ctx.db.patch(current._id, {
        apiId: await allocateTaskLabelApiId(ctx),
        createdBy: null,
        updatedBy: null,
        updatedAt,
        externalSource: null,
        externalId: null,
        revision: current.revision + 1,
      });
      changes.push({ before: current, after: await ctx.db.get(current._id) });
    }
    /* oxlint-enable no-await-in-loop */
    return changes;
  },
});
