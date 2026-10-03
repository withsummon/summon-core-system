import { ConvexError, v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { requireNetworkScope } from "./network_access";
import { canAdministerProject } from "./administration";
import { projectLogoProps, renderedProjectLogo } from "./branding_schema";
import { projectNetwork } from "./network_schema";
import { validateProjectMetadata, validateProjectLead } from "./metadata_fields";
import { requireProjectTimezone } from "./timezone";
import { validateTimezone } from "../settings/timezone";
export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const { project, user, member, membership } = await requireNetworkScope(ctx, args.projectId);
    const canManage = await canAdministerProject(ctx, project, user._id, member.role);
    if (!canManage && !membership?.active) throw new ConvexError("Project not found.");
    return {
      canManage,
      revision: project.metadataRevision,
      input: {
        projectId: project._id,
        name: project.name,
        identifier: project.identifier,
        description: project.description,
        network: project.network ?? 0,
        logoProps: project.logoProps ?? {},
        timezone: requireProjectTimezone(project),
        leadId: project.leadId ?? null,
      },
    };
  },
});
export const save = mutation({
  args: {
    projectId: v.id("projects"),
    expectedRevision: v.number(),
    expectedTimezone: v.string(),
    name: v.string(),
    identifier: v.string(),
    description: v.string(),
    network: projectNetwork,
    logoProps: projectLogoProps,
    timezone: v.string(),
    leadId: v.union(v.id("users"), v.null()),
  },
  handler: async (ctx, args) => {
    const { project, user, member } = await requireNetworkScope(ctx, args.projectId);
    if (!(await canAdministerProject(ctx, project, user._id, member.role)))
      throw new ConvexError("Only workspace or project administrators can edit project settings.");
    if (
      !Number.isSafeInteger(args.expectedRevision) ||
      args.expectedRevision !== project.metadataRevision ||
      args.expectedTimezone !== requireProjectTimezone(project)
    )
      throw new ConvexError("Project changed. Reopen its current settings.");
    const fields = await validateProjectMetadata(ctx, project.workspaceId, args, project._id);
    await validateProjectLead(ctx, project.workspaceId, args.leadId);
    renderedProjectLogo(args.logoProps);
    await ctx.db.patch(project._id, {
      ...fields,
      network: args.network,
      logoProps: args.logoProps,
      leadId: args.leadId,
      timezone: validateTimezone(args.timezone),
      metadataRevision: project.metadataRevision + 1,
    });
  },
});
