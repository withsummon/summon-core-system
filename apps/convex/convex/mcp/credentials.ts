import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation, internalQuery, internalMutation } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { Infer } from "convex/values";
import { requireWorkspace, requireProject } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { credentialFields, credentialInput, permission as grantPermission } from "./schema";
import { audit, credentialMetadataAccess, requireCredential } from "./access";
import { stream } from "convex-helpers/server/stream";
import schema from "../schema";
const metadata = v.object(credentialFields);
async function validate(ctx: QueryCtx, workspaceId: Id<"workspaces">, data: Infer<typeof metadata>) {
  const access = await requireWorkspace(ctx, workspaceId, true);
  const parsed = credentialInput.safeParse(data);
  if (!parsed.success) throw new ConvexError("Enter valid credential metadata.");
  const fields = parsed.data;
  const mcp = fields.provider === undefined || ["plane", "plane_mcp"].includes(fields.provider);
  if (mcp && !/^[a-zA-Z0-9_-]{1,255}$/.test(fields.remoteWorkspaceSlug))
    throw new ConvexError("Enter the remote workspace slug.");
  if (fields.projectId) {
    const { project } = await requireProject(ctx, fields.projectId, true);
    if (project.workspaceId !== workspaceId) throw new ConvexError("Project belongs to another workspace.");
  }
  if (mcp && Boolean(fields.projectId) !== Boolean(fields.remoteProjectId))
    throw new ConvexError("A project credential requires both native and remote project scope.");
  if (fields.remoteProjectId && !/^[a-zA-Z0-9_-]{1,255}$/.test(fields.remoteProjectId))
    throw new ConvexError("Invalid remote project identifier.");

  return { ...access, fields };
}
export const authorizeCreate = internalQuery({
  args: { workspaceId: v.id("workspaces"), ...credentialFields },
  handler: async (ctx, { workspaceId, ...data }) => {
    await validate(ctx, workspaceId, data);
  },
});
export const createEncrypted = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    ...credentialFields,
    ciphertext: v.string(),
    nonce: v.string(),
    keyVersion: v.literal(2),
  },
  handler: async (ctx, { workspaceId, ciphertext, nonce, keyVersion, ...data }) => {
    const { user, fields } = await validate(ctx, workspaceId, data);
    const credentialId = await ctx.db.insert("mcpCredentials", {
      workspaceId,
      ...fields,
      ownerId: user._id,
      status: "active",
      revision: 0,
    });
    await ctx.db.insert("mcpSecrets", { credentialId, ciphertext, nonce, keyVersion });
    await audit(ctx, { _id: credentialId, workspaceId }, user._id, "create");
    return credentialId;
  },
});
export const get = query({
  args: { credentialId: v.id("mcpCredentials") },
  handler: async (ctx, args) => {
    const { credential, permission, canWrite, canUse, canInvokeMcp, canManage, canReveal } = await requireCredential(
      ctx,
      args.credentialId
    );
    return Object.assign(
      credential,
      { permission, canWrite, canUse, canInvokeMcp, canManage, canReveal },
      await credentialActivity(ctx, credential._id)
    );
  },
});
export const list = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    return stream(ctx.db, schema)
      .query("mcpCredentials")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .map(async (credential) => {
        const metadataAccess = await credentialMetadataAccess(ctx, credential, user._id);
        return metadataAccess
          ? Object.assign(credential, metadataAccess, await credentialActivity(ctx, credential._id))
          : null;
      })
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const grant = mutation({
  args: {
    credentialId: v.id("mcpCredentials"),
    memberId: v.id("users"),
    permission: grantPermission,
    expiresAt: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    const { credential, user } = await requireCredential(ctx, args.credentialId, "manage");
    const member = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", credential.workspaceId).eq("userId", args.memberId))
      .unique();
    if (!member?.active) throw new ConvexError("Grant recipient must be an active workspace member.");
    if (args.memberId === credential.ownerId) throw new ConvexError("Owner already manages this credential.");
    if (args.expiresAt !== null && (!Number.isSafeInteger(args.expiresAt) || args.expiresAt <= Date.now()))
      throw new ConvexError("Expiration must be in the future.");
    const existing = await ctx.db
      .query("mcpGrants")
      .withIndex("by_credential_member", (q) => q.eq("credentialId", args.credentialId).eq("memberId", args.memberId))
      .unique();
    if (existing) throw new ConvexError("Member already has a grant. Revoke it before granting again.");
    const id = await ctx.db.insert("mcpGrants", { ...args, grantedBy: user._id });
    await audit(ctx, credential, user._id, "grant", null, args.memberId);
    return id;
  },
});
export const revokeGrant = mutation({
  args: { grantId: v.id("mcpGrants") },
  handler: async (ctx, { grantId }) => {
    const existingGrant = await ctx.db.get(grantId);
    if (!existingGrant) throw new ConvexError("Grant not found.");
    const { credential, user } = await requireCredential(ctx, existingGrant.credentialId, "manage");
    await ctx.db.delete(grantId);
    await audit(ctx, credential, user._id, "revoke_grant", null, existingGrant.memberId);
  },
});
export const grants = query({
  args: { credentialId: v.id("mcpCredentials"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireCredential(ctx, args.credentialId, "manage");
    return ctx.db
      .query("mcpGrants")
      .withIndex("by_credential", (q) => q.eq("credentialId", args.credentialId))
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const logs = query({
  args: { credentialId: v.id("mcpCredentials"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireCredential(ctx, args.credentialId, "manage");
    return ctx.db
      .query("mcpAudit")
      .withIndex("by_credential", (q) => q.eq("credentialId", args.credentialId))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
  },
});

export const update = mutation({
  args: { credentialId: v.id("mcpCredentials"), expectedRevision: v.number(), ...credentialFields },
  handler: async (ctx, { credentialId, expectedRevision, ...data }) => {
    const { credential, user } = await requireCredential(ctx, credentialId, "manage");
    if (expectedRevision !== credential.revision)
      throw new ConvexError("Credential changed. Reopen its latest settings before saving.");
    const { fields } = await validate(ctx, credential.workspaceId, data);
    await ctx.db.patch(credentialId, { ...fields, revision: credential.revision + 1 });
    await audit(ctx, credential, user._id, "update");
  },
});
export const resolve = query({
  args: { credentialId: v.string() },
  handler: async (ctx, args) => {
    const credentialId = ctx.db.normalizeId("mcpCredentials", args.credentialId);
    if (!credentialId) throw new ConvexError("Credential not found.");
    const { credential, permission, canWrite, canUse, canInvokeMcp, canManage, canReveal } = await requireCredential(
      ctx,
      credentialId
    );
    return Object.assign(
      credential,
      { permission, canWrite, canUse, canInvokeMcp, canManage, canReveal },
      await credentialActivity(ctx, credential._id)
    );
  },
});

async function credentialActivity(ctx: QueryCtx, credentialId: Id<"mcpCredentials">) {
  const [used, revealed] = await Promise.all(
    ["use", "reveal"].map((action) =>
      ctx.db
        .query("mcpAudit")
        .withIndex("by_credential_action", (q) => q.eq("credentialId", credentialId).eq("action", action))
        .order("desc")
        .first()
    )
  );
  return {
    lastUsedAt: used?._creationTime ?? null,
    lastAccessedAt: Math.max(used?._creationTime ?? 0, revealed?._creationTime ?? 0) || null,
  };
}
