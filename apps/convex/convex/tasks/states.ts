import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireProject } from "../identity/access";
import { stateFields } from "./schema";
import { text } from "../commercial/validation";
export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await requireProject(ctx, args.projectId);
    const states = await ctx.db
      .query("taskStates")
      .withIndex("by_project_order", (q) => q.eq("projectId", args.projectId))
      .collect();
    return states.flatMap((state) => (state.status === "triage" ? [] : [{ ...state, status: state.status }]));
  },
});
export const save = mutation({
  args: { projectId: v.id("projects"), stateId: v.optional(v.id("taskStates")), data: v.object(stateFields) },
  handler: async (ctx, args) => {
    const { project, projectMember } = await requireProject(ctx, args.projectId, true);
    if (projectMember.role !== "admin") throw new ConvexError("Only project administrators can manage task states.");
    const name = text(args.data.name, "State name", 255, true);
    const description = text(args.data.description, "State description", 10000);
    const color = text(args.data.color, "State color", 255);
    if (!Number.isFinite(args.data.sortOrder)) throw new ConvexError("State order must be finite.");
    const existing = args.stateId ? await ctx.db.get(args.stateId) : null;
    if (existing?.status === "triage") throw new ConvexError("The intake state is managed by intake.");
    if (args.stateId && (!existing || existing.projectId !== project._id))
      throw new ConvexError("State not found in this project.");
    const duplicate = await ctx.db
      .query("taskStates")
      .withIndex("by_project_name", (q) => q.eq("projectId", project._id).eq("name", name))
      .unique();
    if (duplicate && duplicate._id !== args.stateId) throw new ConvexError("This state name already exists.");
    // Group is materialized on tasks for indexed subscriptions. Moving populated groups requires a separate migration.
    if (existing && existing.status !== args.data.status) {
      const assigned = await ctx.db
        .query("tasks")
        .withIndex("by_state", (q) => q.eq("stateId", existing._id))
        .first();
      if (assigned) throw new ConvexError("Move tasks out of this state before changing its group.");
    }
    if (args.data.isDefault) {
      const previous = await ctx.db
        .query("taskStates")
        .withIndex("by_project_default", (q) => q.eq("projectId", project._id).eq("isDefault", true))
        .unique();
      if (previous) await ctx.db.patch(previous._id, { isDefault: false });
    }
    const data = { ...args.data, name, description, color };
    if (args.stateId) {
      await ctx.db.patch(args.stateId, data);
      return args.stateId;
    }
    if (
      (
        await ctx.db
          .query("taskStates")
          .withIndex("by_project_order", (q) => q.eq("projectId", project._id))
          .take(100)
      ).length >= 100
    )
      throw new ConvexError("A project supports up to 100 task states.");
    return ctx.db.insert("taskStates", { ...data, workspaceId: project.workspaceId, projectId: project._id });
  },
});
export const remove = mutation({
  args: { stateId: v.id("taskStates") },
  handler: async (ctx, args) => {
    const state = await ctx.db.get(args.stateId);
    if (!state || state.status === "triage") throw new ConvexError("State not found.");
    const { projectMember } = await requireProject(ctx, state.projectId, true);
    if (projectMember.role !== "admin") throw new ConvexError("Only project administrators can manage task states.");
    if (state.isDefault) throw new ConvexError("Choose another default state first.");
    if (
      await ctx.db
        .query("tasks")
        .withIndex("by_state", (q) => q.eq("stateId", state._id))
        .first()
    )
      throw new ConvexError("Move tasks out of this state before deleting it.");
    await ctx.db.delete(state._id);
  },
});
