import { initializeProjectOrder } from "./order_owner";
import { workspaceTimezone } from "../settings/timezone";
import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireWorkspace } from "../identity/access";

export async function createProject(
  ctx: MutationCtx,
  args: { workspaceId: Id<"workspaces">; name: string; identifier: string }
) {
  const { user, member } = await requireWorkspace(ctx, args.workspaceId, true);
  if (member.role !== "admin") throw new ConvexError("Only workspace administrators can create projects.");
  const name = args.name.trim();
  const identifier = args.identifier.trim().toUpperCase();
  if (!name || name.length > 120 || !/^[A-Z][A-Z0-9]{1,9}$/.test(identifier))
    throw new ConvexError("Enter a project name and a 2–10 character identifier.");
  if (
    await ctx.db
      .query("projects")
      .withIndex("by_workspace_identifier", (q) => q.eq("workspaceId", args.workspaceId).eq("identifier", identifier))
      .unique()
  )
    throw new ConvexError("This project identifier is already taken.");
  const projectId = await ctx.db.insert("projects", {
    workspaceId: args.workspaceId,
    name,
    identifier,
    timezone: await workspaceTimezone(ctx, args.workspaceId),
    description: "",
    metadataRevision: 0,
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
  return projectId;
}
