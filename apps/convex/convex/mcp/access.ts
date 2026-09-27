import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";
import { requireWorkspace, requireProject } from "../identity/access";
export async function credentialPermission(ctx: QueryCtx, credential: Doc<"mcpCredentials">, userId: Id<"users">) {
  if (credential.ownerId === userId) return "manage" as const;
  const grant = await ctx.db
    .query("mcpGrants")
    .withIndex("by_credential_member", (q) => q.eq("credentialId", credential._id).eq("memberId", userId))
    .unique();
  return grant && (grant.expiresAt === null || grant.expiresAt > Date.now()) ? grant.permission : null;
}
// Shared nullable metadata ACL for paginated credential/resource projections.
export async function credentialMetadataAccess(ctx: QueryCtx, credential: Doc<"mcpCredentials">, userId: Id<"users">) {
  if (credential.status === "deleted") return null;
  const workspace = await ctx.db.get(credential.workspaceId);
  if (!workspace || workspace.deletedAt != null) return null;
  const workspaceMember = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) => q.eq("workspaceId", credential.workspaceId).eq("userId", userId))
    .unique();
  if (!workspaceMember?.active) return null;
  const granted = await credentialPermission(ctx, credential, userId);
  if (!granted) return null;
  let projectRole: Doc<"projectMembers">["role"] | null = null;
  if (credential.projectId) {
    const projectId = credential.projectId;
    const project = await ctx.db.get(projectId);
    const member = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", userId))
      .unique();
    if (
      !project ||
      project.archived ||
      project.deletedAt != null ||
      project.workspaceId !== credential.workspaceId ||
      !member?.active
    )
      return null;
    projectRole = member.role;
  }
  return {
    permission: granted,
    ...credentialCapabilities(workspaceMember.role, projectRole, granted, credential.status),
  };
}
export async function requireCredential(
  ctx: QueryCtx,
  credentialId: Id<"mcpCredentials">,
  access: "view" | "use" | "manage" = "view"
) {
  const credential = await ctx.db.get(credentialId);
  if (!credential || credential.status === "deleted") throw new ConvexError("Credential not found.");
  const scope = await requireWorkspace(ctx, credential.workspaceId, access !== "view");
  const projectAccess = credential.projectId
    ? await requireProject(ctx, credential.projectId, access !== "view")
    : null;
  const granted = await credentialPermission(ctx, credential, scope.user._id);
  if (!granted || (access === "manage" && granted !== "manage") || (access === "use" && granted === "view"))
    throw new ConvexError("Credential access denied.");
  return {
    ...scope,
    credential,
    permission: granted,
    ...credentialCapabilities(scope.member.role, projectAccess?.projectMember.role ?? null, granted, credential.status),
  };
}
export async function audit(
  ctx: MutationCtx,
  credential: Pick<Doc<"mcpCredentials">, "_id" | "workspaceId">,
  actorId: Id<"users">,
  action: string,
  invocationId: Id<"mcpInvocations"> | null = null,
  memberId: Id<"users"> | null = null
) {
  await ctx.db.insert("mcpAudit", {
    workspaceId: credential.workspaceId,
    credentialId: credential._id,
    actorId,
    action,
    invocationId,
    memberId,
  });
}

export function credentialCapabilities(
  workspaceRole: Doc<"workspaceMembers">["role"],
  projectRole: Doc<"projectMembers">["role"] | null,
  permission: "view" | "use" | "manage",
  status: Doc<"mcpCredentials">["status"]
) {
  const canWrite = workspaceRole !== "guest" && projectRole !== "guest";
  return {
    canWrite,
    canUse: canWrite && permission !== "view" && status === "active",
    canManage: canWrite && permission === "manage",
    canReveal: workspaceRole !== "guest" && permission !== "use",
  };
}
