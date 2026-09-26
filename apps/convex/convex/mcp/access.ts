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
export async function requireCredential(
  ctx: QueryCtx,
  credentialId: Id<"mcpCredentials">,
  access: "view" | "use" | "manage" = "view"
) {
  const credential = await ctx.db.get(credentialId);
  if (!credential || credential.status === "deleted") throw new ConvexError("Credential not found.");
  const scope = await requireWorkspace(ctx, credential.workspaceId, access !== "view");
  if (credential.projectId) await requireProject(ctx, credential.projectId, access !== "view");
  const granted = await credentialPermission(ctx, credential, scope.user._id);
  if (!granted || (access === "manage" && granted !== "manage") || (access === "use" && granted === "view"))
    throw new ConvexError("Credential access denied.");
  return { ...scope, credential, permission: granted };
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
