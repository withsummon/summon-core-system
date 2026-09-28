import { defineTable } from "convex/server";
import { v } from "convex/values";
export const operation = v.union(v.literal("reveal"), v.literal("rotate"), v.literal("revoke"), v.literal("delete"));
export const permission = v.union(v.literal("view"), v.literal("use"), v.literal("manage"));
export const credentialFields = {
  name: v.string(),
  accountIdentifier: v.string(),
  projectId: v.union(v.id("projects"), v.null()),
  remoteWorkspaceSlug: v.string(),
  remoteProjectId: v.union(v.string(), v.null()),
};
export const mcpTables = {
  mcpStepUps: defineTable({
    credentialId: v.id("mcpCredentials"),
    actorId: v.id("users"),
    sessionId: v.string(),
    operation,
    credentialRevision: v.number(),
    expiresAt: v.number(),
    consumed: v.boolean(),
  }).index("by_expiry", ["expiresAt"]),
  mcpCredentials: defineTable({
    workspaceId: v.id("workspaces"),
    ownerId: v.id("users"),
    ...credentialFields,
    status: v.union(v.literal("active"), v.literal("revoked"), v.literal("deleted")),
    revision: v.number(),
  }).index("by_workspace", ["workspaceId"]),
  mcpSecrets: defineTable({
    credentialId: v.id("mcpCredentials"),
    ciphertext: v.string(),
    nonce: v.string(),
    keyVersion: v.literal(2),
  }).index("by_credential", ["credentialId"]),
  mcpGrants: defineTable({
    credentialId: v.id("mcpCredentials"),
    memberId: v.id("users"),
    permission,
    expiresAt: v.union(v.number(), v.null()),
    grantedBy: v.id("users"),
  })
    .index("by_credential_member", ["credentialId", "memberId"])
    .index("by_credential", ["credentialId"]),
  mcpAudit: defineTable({
    workspaceId: v.id("workspaces"),
    credentialId: v.id("mcpCredentials"),
    actorId: v.id("users"),
    action: v.string(),
    invocationId: v.union(v.id("mcpInvocations"), v.null()),
    memberId: v.union(v.id("users"), v.null()),
  }).index("by_credential", ["credentialId"]),
  mcpInvocations: defineTable({
    workspaceId: v.id("workspaces"),
    credentialId: v.id("mcpCredentials"),
    requesterId: v.id("users"),
    requestId: v.string(),
    credentialRevision: v.number(),
    tool: v.string(),
    argumentsJson: v.string(),
    write: v.boolean(),
    status: v.union(
      v.literal("pending"),
      v.literal("dispatching"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("unknown"),
      v.literal("cancelled")
    ),
    resultJson: v.union(v.string(), v.null()),
    error: v.union(v.string(), v.null()),
  })
    .index("by_credential_requester", ["credentialId", "requesterId"])
    .index("by_requester_request", ["requesterId", "requestId"]),
};
