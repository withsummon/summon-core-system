import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireProject } from "../identity/access";
import { labelFields } from "./schema";
import { text } from "../commercial/validation";
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
  args: { projectId: v.id("projects"), labelId: v.optional(v.id("taskLabels")), data: v.object(labelFields) },
  handler: async (ctx, args) => {
    const { project, projectMember } = await requireProject(ctx, args.projectId, true);
    if (projectMember.role !== "admin") throw new ConvexError("Only project administrators can manage labels.");
    const name = text(args.data.name, "Label name", 255, true);
    const description = text(args.data.description, "Label description", 10000);
    const color = text(args.data.color, "Label color", 255);
    if (!Number.isFinite(args.data.sortOrder)) throw new ConvexError("Label order must be finite.");
    if (args.labelId) {
      const existing = await ctx.db.get(args.labelId);
      if (!existing || existing.projectId !== project._id) throw new ConvexError("Label not found in this project.");
    }
    const duplicate = await ctx.db
      .query("taskLabels")
      .withIndex("by_project_name", (q) => q.eq("projectId", project._id).eq("name", name))
      .unique();
    if (duplicate && duplicate._id !== args.labelId) throw new ConvexError("This label name already exists.");
    const data = { ...args.data, name, description, color };
    if (args.labelId) {
      await ctx.db.patch(args.labelId, data);
      return args.labelId;
    }
    if (
      (
        await ctx.db
          .query("taskLabels")
          .withIndex("by_project_order", (q) => q.eq("projectId", project._id))
          .take(1000)
      ).length >= 1000
    )
      throw new ConvexError("A project supports up to 1000 labels.");
    return ctx.db.insert("taskLabels", {
      ...data,
      workspaceId: project.workspaceId,
      projectId: project._id,
      parentId: null,
      revision: 0,
      retiring: false,
    });
  },
});
