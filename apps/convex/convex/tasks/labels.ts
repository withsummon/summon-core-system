import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireProject } from "../identity/access";
import { labelFields } from "./schema";
import { text } from "../commercial/validation";
import type { Doc, Id } from "../_generated/dataModel";
export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await requireProject(ctx, args.projectId);
    return ctx.db
      .query("taskLabels")
      .withIndex("by_project_order", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});
export const save = mutation({
  args: {
    projectId: v.id("projects"),
    labelId: v.optional(v.id("taskLabels")),
    expectedRevision: v.optional(v.number()),
    parentId: v.union(v.id("taskLabels"), v.null()),
    data: v.object(labelFields),
  },
  handler: async (ctx, args) => {
    const { project, projectMember } = await requireProject(ctx, args.projectId, true);
    if (projectMember.role !== "admin") throw new ConvexError("Only project administrators can manage labels.");
    const name = text(args.data.name, "Label name", 255, true),
      description = text(args.data.description, "Label description", 10000),
      color = text(args.data.color, "Label color", 255);
    if (!Number.isFinite(args.data.sortOrder)) throw new ConvexError("Label order must be finite.");
    const rows = await ctx.db
      .query("taskLabels")
      .withIndex("by_project_order", (q) => q.eq("projectId", project._id))
      .take(1001);
    const existing = args.labelId ? rows.find((row) => row._id === args.labelId) : null;
    if (args.labelId && (!existing || existing.retiring))
      throw new ConvexError("Label is unavailable or being removed.");
    if (existing && args.expectedRevision !== existing.revision)
      throw new ConvexError("Label changed. Reopen its latest settings.");
    if (rows.some((row) => row._id !== args.labelId && row.name.toLocaleLowerCase() === name.toLocaleLowerCase()))
      throw new ConvexError("This label name already exists.");
    validateLabelGroups(rows, existing, args.parentId);
    const data = { ...args.data, name, description, color, parentId: args.parentId };
    if (existing) {
      await ctx.db.patch(existing._id, { ...data, revision: existing.revision + 1 });
      return existing._id;
    }
    if (rows.length >= 1000) throw new ConvexError("A project supports up to 1000 labels.");
    return ctx.db.insert("taskLabels", {
      ...data,
      workspaceId: project.workspaceId,
      projectId: project._id,
      revision: 0,
      retiring: false,
    });
  },
});

function validateLabelGroups(
  rows: Doc<"taskLabels">[],
  existing: Doc<"taskLabels"> | null | undefined,
  parentId: Id<"taskLabels"> | null
) {
  if (parentId) {
    const parent = rows.find((row) => row._id === parentId);
    if (!parent || parent.retiring) throw new ConvexError("Choose an active group in this project.");
  }
  if (existing) {
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
  } else if (parentId) {
    let current: Id<"taskLabels"> | null = parentId,
      depth = 1;
    while (current) {
      if (++depth > 20) throw new ConvexError("Label groups support at most 20 levels.");
      current = rows.find((row) => row._id === current)?.parentId ?? null;
    }
  }
}
