import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { requireProject } from "../identity/access";
import { canAdministerProject } from "../projects/administration";
import { labelFields } from "./schema";
import { requireLabelManagement } from "./label_access";
import { text } from "../commercial/validation";
import type { Doc, Id } from "../_generated/dataModel";
async function projectLabels(ctx: QueryCtx, projectId: Id<"projects">) {
  const rows = await ctx.db
    .query("taskLabels")
    .withIndex("by_project_order", (q) => q.eq("projectId", projectId))
    .take(1001);
  if (rows.length > 1000) throw new ConvexError("A project supports up to 1000 labels.");
  return rows;
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
    const { project } = await requireLabelManagement(ctx, args.projectId);
    const rows = await projectLabels(ctx, project._id);
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
      if (existing) {
        await ctx.db.patch(existing._id, { ...data, revision: existing.revision + 1 });
        return existing._id;
      }
      if (rows.length >= 1000) throw new ConvexError("A project supports up to 1000 labels.");
      return ctx.db.insert("taskLabels", {
        ...data,
        sortOrder: (rows.at(-1)?.sortOrder ?? 0) + 10000,
        parentId: null,
        workspaceId: project.workspaceId,
        projectId: project._id,
        revision: 0,
        retiring: false,
      });
    }
    if (!existing) throw new ConvexError("Choose an existing label to move.");
    const { parentId, position } = args.change;
    validateLabelGroups(rows, existing, parentId);
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
        if (row.sortOrder !== sortOrder) await ctx.db.patch(row._id, { sortOrder, revision: row.revision + 1 });
      })
    );
    await ctx.db.patch(existing._id, { parentId, sortOrder: (index + 1) * 10000, revision: existing.revision + 1 });
    return existing._id;
  },
});

function validateLabelGroups(
  rows: Doc<"taskLabels">[],
  existing: Doc<"taskLabels">,
  parentId: Id<"taskLabels"> | null
) {
  if (parentId) {
    const parent = rows.find((row) => row._id === parentId);
    if (!parent || parent.retiring) throw new ConvexError("Choose an active group in this project.");
  }
  const parents = new Map(rows.map((row) => [row._id, row._id === existing._id ? parentId : row.parentId]));
  for (const row of rows) {
    const visited = new Set<Id<"taskLabels">>();
    let current: Id<"taskLabels"> | null = row._id;
    while (current) {
      if (visited.has(current)) throw new ConvexError("A label cannot contain itself or its ancestors.");
      visited.add(current);
      if (visited.size > 20) throw new ConvexError("Label groups support at most 20 levels.");
      current = parents.get(current) ?? null;
    }
  }
}
