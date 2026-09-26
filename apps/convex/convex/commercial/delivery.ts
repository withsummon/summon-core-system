import { v, ConvexError } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireWorkspace, requireProject } from "../identity/access";
import { createProject } from "../projects/create";
import { requireOpportunity } from "./opportunities";
import { requireClient, parseProfile, validateClient } from "./validation";
import { profileFields } from "./schema";

// Both handoff paths and profile edits require project-admin authority, never workspace-admin bypass.
async function requireDeliveryAdministrator(ctx: MutationCtx, projectId: Id<"projects">) {
  const access = await requireProject(ctx, projectId, true);
  if (access.projectMember.role !== "admin") throw new ConvexError("Only project administrators can manage delivery.");
  return access;
}

export const start = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    opportunityId: v.id("opportunities"),
    target: v.union(
      v.object({ kind: v.literal("existing"), projectId: v.id("projects") }),
      v.object({ kind: v.literal("create"), name: v.string(), identifier: v.string() })
    ),
  },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId, true);
    const opportunity = await requireOpportunity(ctx, args.workspaceId, args.opportunityId);
    if (opportunity.stage !== "won") throw new ConvexError("Mark the opportunity as won before starting delivery.");
    if (!opportunity.clientId) throw new ConvexError("Link a client before starting delivery.");
    await requireClient(ctx, args.workspaceId, opportunity.clientId);
    const linked = await ctx.db
      .query("projectProfiles")
      .withIndex("by_opportunity", (q) => q.eq("sourceOpportunityId", opportunity._id))
      .unique();
    if (linked) {
      await requireDeliveryAdministrator(ctx, linked.projectId);
      if (args.target.kind === "existing" && args.target.projectId !== linked.projectId)
        throw new ConvexError("This opportunity already has a delivery project.");
      return { profileId: linked._id, projectId: linked.projectId, created: false };
    }
    const projectId =
      args.target.kind === "create"
        ? await createProject(ctx, {
            workspaceId: args.workspaceId,
            name: args.target.name,
            identifier: args.target.identifier,
          })
        : args.target.projectId;
    const access = await requireDeliveryAdministrator(ctx, projectId);
    if (access.project.workspaceId !== args.workspaceId) throw new ConvexError("Project not found in this workspace.");
    const profile = await ctx.db
      .query("projectProfiles")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .unique();
    if (profile) {
      if (profile.sourceOpportunityId || (profile.clientId && profile.clientId !== opportunity.clientId))
        throw new ConvexError("This project is already linked to another client or opportunity.");
      await ctx.db.patch(profile._id, {
        clientId: opportunity.clientId,
        sourceOpportunityId: opportunity._id,
        updatedBy: user._id,
        updatedAt: Date.now(),
      });
      return { profileId: profile._id, projectId, created: false };
    }
    const profileId = await ctx.db.insert("projectProfiles", {
      workspaceId: args.workspaceId,
      projectId,
      clientId: opportunity.clientId,
      sourceOpportunityId: opportunity._id,
      deliveryStatus: "not_assessed",
      phase: "",
      health: "not_assessed",
      startDate: null,
      targetDate: null,
      budget: null,
      createdBy: user._id,
      updatedBy: user._id,
      updatedAt: Date.now(),
      deleted: false,
    });
    return { profileId, projectId, created: true };
  },
});
export const getProfile = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await requireProject(ctx, args.projectId);
    return ctx.db
      .query("projectProfiles")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();
  },
});
export const saveProfile = mutation({
  args: { projectId: v.id("projects"), data: v.object(profileFields) },
  handler: async (ctx, args) => {
    const access = await requireDeliveryAdministrator(ctx, args.projectId);
    const data = parseProfile(args.data);
    await validateClient(ctx, access.project.workspaceId, data.clientId);
    const profile = await ctx.db
      .query("projectProfiles")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();
    if (profile?.sourceOpportunityId && profile.clientId !== data.clientId)
      throw new ConvexError("Client must match the source opportunity's client.");
    const updated = { ...data, updatedBy: access.user._id, updatedAt: Date.now() };
    if (profile) {
      await ctx.db.patch(profile._id, updated);
      return profile._id;
    }
    return ctx.db.insert("projectProfiles", {
      ...updated,
      workspaceId: access.project.workspaceId,
      projectId: args.projectId,
      sourceOpportunityId: null,
      createdBy: access.user._id,
      deleted: false,
    });
  },
});

// Commercial workspace visibility never grants access to a linked delivery project.
export const getForOpportunity = query({
  args: { workspaceId: v.id("workspaces"), opportunityId: v.id("opportunities") },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    await requireOpportunity(ctx, args.workspaceId, args.opportunityId);
    const profile = await ctx.db
      .query("projectProfiles")
      .withIndex("by_opportunity", (q) => q.eq("sourceOpportunityId", args.opportunityId))
      .unique();
    if (!profile) return null;
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", profile.projectId).eq("userId", user._id))
      .unique();
    if (!membership?.active) return null;
    const project = await ctx.db.get(profile.projectId);
    if (!project || project.archived || project.workspaceId !== args.workspaceId) return null;
    return { profile, project };
  },
});
