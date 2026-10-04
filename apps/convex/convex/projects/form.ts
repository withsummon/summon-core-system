import { ConvexError, v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { requireNetworkScope } from "./network_access";
import { canAdministerProject } from "./administration";
import { projectLogoProps, renderedProjectLogo, validatedProjectLogo } from "./branding_schema";
import { projectNetwork } from "./network_schema";
import { validateProjectMetadata, validateProjectLead } from "./metadata_fields";
import { requireProjectTimezone } from "./timezone";
import { validateTimezone } from "../settings/timezone";
import { projectCover, requireCoverWrite, replaceProjectCover } from "./cover_owner";
import { fileMetadataFields } from "../assets/schema";
import { prepareAsset } from "../assets/index";
import { requireAsset } from "../assets/access";
import { requireLifecycle } from "./lifecycle";
import type { Doc } from "../_generated/dataModel";
export const get = query({
  args: { projectId: v.string(), workspaceId: v.optional(v.id("workspaces")) },
  handler: async (ctx, args) => {
    const projectId = ctx.db.normalizeId("projects", args.projectId);
    const project = projectId ? await ctx.db.get(projectId) : null;
    if (!project || (args.workspaceId !== undefined && args.workspaceId !== project.workspaceId))
      throw new ConvexError("Project not found.");
    const available = !project.archived && project.deletedAt == null;
    let canManage = false;
    let role: Doc<"projectMembers">["role"];
    if (available) {
      const { user, member, membership } = await requireNetworkScope(ctx, project._id);
      canManage = await canAdministerProject(ctx, project, user._id, member.role);
      if (canManage) role = "admin";
      else {
        if (!membership?.active) throw new ConvexError("Project not found.");
        role = member.role === "guest" ? member.role : membership.role;
      }
    } else {
      await requireLifecycle(ctx, project._id);
      role = "admin";
    }
    return {
      canManage,
      available,
      shell: {
        projectId: project._id,
        name: project.name,
        role,
        logo: renderedProjectLogo(project.logoProps ?? {}),
        canConfigure: canManage,
      },
      createdAt: project._creationTime,
      appearance: await projectCover(ctx, project._id),
      revision: project.metadataRevision,
      input: {
        projectId: project._id,
        name: project.name,
        identifier: project.identifier,
        description: project.description,
        network: project.network ?? 0,
        logoProps: validatedProjectLogo(project.logoProps ?? {}),
        timezone: requireProjectTimezone(project),
        leadId: project.leadId ?? null,
      },
    };
  },
});
export const prepareCover = mutation({
  args: {
    projectId: v.id("projects"),
    expectedRevision: v.number(),
    expectedCoverRevision: v.number(),
    ...fileMetadataFields,
  },
  handler: async (ctx, { expectedRevision, expectedCoverRevision, ...metadata }) => {
    const { project } = await requireCoverWrite(ctx, metadata.projectId, expectedCoverRevision);
    if (!Number.isSafeInteger(expectedRevision) || project.metadataRevision !== expectedRevision)
      throw new ConvexError("Project changed. Reopen its current settings.");
    if (!metadata.contentType.startsWith("image/"))
      throw new ConvexError("Choose a supported image for the project cover.");
    return prepareAsset(
      ctx,
      { ...metadata, workspaceId: project.workspaceId, documentId: null },
      {
        purpose: "projectCover",
        projectCoverRevision: expectedCoverRevision,
        projectCoverFormRevision: expectedRevision,
      }
    );
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
    cover: v.optional(v.object({ assetId: v.union(v.id("assets"), v.null()), expectedRevision: v.number() })),
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
    if (args.leadId !== (project.leadId ?? null)) await validateProjectLead(ctx, project.workspaceId, args.leadId);
    validatedProjectLogo(args.logoProps);
    const timezone = validateTimezone(args.timezone);
    if (args.cover) {
      const { appearance } = await requireCoverWrite(ctx, project._id, args.cover.expectedRevision);
      if (args.cover.assetId) {
        const { asset } = await requireAsset(ctx, args.cover.assetId, true);
        if (
          asset.purpose !== "projectCover" ||
          asset.projectId !== project._id ||
          asset.projectCoverFormRevision !== args.expectedRevision ||
          asset.projectCoverRevision !== args.cover.expectedRevision ||
          !asset.storageId ||
          !(await ctx.db.system.get(asset.storageId))
        )
          throw new ConvexError("This project cover draft is unavailable. Choose the image again.");
        await replaceProjectCover(ctx, project._id, appearance, asset._id, true);
        await ctx.db.patch(asset._id, { projectCoverFormRevision: undefined });
      } else await replaceProjectCover(ctx, project._id, appearance, null, true);
    }
    await ctx.db.patch(project._id, {
      ...fields,
      network: args.network,
      logoProps: args.logoProps,
      leadId: args.leadId,
      timezone,
      metadataRevision: project.metadataRevision + 1,
    });
    return { revision: project.metadataRevision + 1 };
  },
});
