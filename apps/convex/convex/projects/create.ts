import { validateProjectMetadata, validateProjectLead } from "./metadata_fields";
import { grantProjectMembership } from "./index";
import { renderedProjectLogo, type ProjectLogoProps } from "./branding_schema";
import type { ProjectNetwork } from "./network_schema";
import { defaultProjectFeatures } from "./feature_schema";
import { initializeProjectOrder } from "./order_owner";
import { workspaceTimezone, validateTimezone } from "../settings/timezone";
import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireWorkspace } from "../identity/access";

export async function createProject(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    name: string;
    identifier: string;
    network?: ProjectNetwork;
    logoProps?: ProjectLogoProps;
    description?: string;
    leadId?: Id<"users"> | null;
    timezone?: string;
  }
): Promise<Id<"projects">> {
  const { user, member } = await requireWorkspace(ctx, args.workspaceId, true);
  if (member.role !== "admin") throw new ConvexError("Only workspace administrators can create projects.");
  renderedProjectLogo(args.logoProps ?? {});
  const metadata = await validateProjectMetadata(ctx, args.workspaceId, {
    ...args,
    description: args.description ?? "",
  });
  const leadId = args.leadId ?? null;
  await validateProjectLead(ctx, args.workspaceId, leadId);
  const projectId = await ctx.db.insert("projects", {
    workspaceId: args.workspaceId,
    ...metadata,
    leadId,
    timezone:
      args.timezone === undefined ? await workspaceTimezone(ctx, args.workspaceId) : validateTimezone(args.timezone),
    metadataRevision: 0,
    features: defaultProjectFeatures,
    network: args.network ?? 2,
    logoProps: args.logoProps ?? {},
    intakeEnabled: false,
    guestViewAllFeatures: false,
    nextSequence: 1,
    archived: false,
    deletedAt: null,
  });
  await ctx.db.insert("projectMembers", {
    workspaceId: args.workspaceId,
    projectId,
    userId: user._id,
    role: "admin",
    active: true,
  });
  await initializeProjectOrder(ctx, { workspaceId: args.workspaceId, projectId, userId: user._id });
  if (leadId && leadId !== user._id)
    await grantProjectMembership(ctx, {
      workspaceId: args.workspaceId,
      projectId,
      userId: leadId,
      role: "admin",
    });
  return projectId;
}
