import { projectLogoProps, renderedProjectLogo } from "./branding_schema";
import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireNetworkScope } from "./network_access";
import { canAdministerProject } from "./administration";
export const save = mutation({
  args: { projectId: v.id("projects"), expectedRevision: v.number(), logoProps: projectLogoProps },
  handler: async (ctx, args) => {
    const { project, user, member } = await requireNetworkScope(ctx, args.projectId);
    if (!(await canAdministerProject(ctx, project, user._id, member.role)))
      throw new ConvexError("Only workspace or project administrators can edit project branding.");
    if (!Number.isSafeInteger(args.expectedRevision) || project.metadataRevision !== args.expectedRevision)
      throw new ConvexError("Project changed. Reopen its current settings.");
    renderedProjectLogo(args.logoProps);
    await ctx.db.patch(project._id, {
      logoProps: args.logoProps,
      metadataRevision: project.metadataRevision + 1,
      updatedAt: Date.now(),
      updatedById: user._id,
    });
  },
});
