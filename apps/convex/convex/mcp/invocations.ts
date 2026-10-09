import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query, internalMutation, internalQuery } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireUser } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { requireConversation } from "../assistant/access";
import { authorizedContext } from "../assistant/context";
import { credentialMetadataAccess, requireCredential, audit } from "./access";
import { endpoint } from "./transport";
import { validateTool, toolCapabilities } from "./tools";
async function requireInvocation(ctx: QueryCtx, invocationId: Id<"mcpInvocations">) {
  const invocation = await ctx.db.get(invocationId);
  if (!invocation) throw new ConvexError("Invocation not found.");
  const access = await requireCredential(ctx, invocation.credentialId, "use");
  if (invocation.conversationId) {
    const { conversation } = await requireConversation(ctx, invocation.conversationId);
    await authorizedContext(ctx, conversation.workspaceId, conversation.context);
  }
  if (invocation.requesterId !== access.user._id)
    throw new ConvexError("Only the requester can access this invocation.");
  return { ...access, invocation };
}
export const propose = mutation({
  args: {
    conversationId: v.optional(v.id("assistantConversations")),
    credentialId: v.id("mcpCredentials"),
    requestId: v.string(),
    tool: v.string(),
    argumentsJson: v.string(),
  },
  handler: async (ctx, args) => {
    const { credential, user, canInvokeMcp } = await requireCredential(ctx, args.credentialId, "use");
    const conversation = args.conversationId
      ? (await requireConversation(ctx, args.conversationId, true)).conversation
      : null;
    if (
      conversation &&
      (conversation.workspaceId !== credential.workspaceId ||
        (conversation.context.projectId &&
          credential.projectId &&
          conversation.context.projectId !== credential.projectId))
    )
      throw new ConvexError("MCP credential is outside this conversation context.");
    if (conversation) await authorizedContext(ctx, conversation.workspaceId, conversation.context);
    if (!canInvokeMcp) throw new ConvexError("Only Plane MCP credentials can run MCP requests.");
    if (credential.status !== "active") throw new ConvexError("Credential is revoked.");
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(args.requestId)) throw new ConvexError("Invalid request identifier.");
    const validated = validateTool(args.tool, args.argumentsJson, credential);
    const previous = await ctx.db
      .query("mcpInvocations")
      .withIndex("by_requester_request", (q) => q.eq("requesterId", user._id).eq("requestId", args.requestId))
      .unique();
    if (previous) {
      if (
        previous.conversationId !== args.conversationId ||
        previous.credentialId !== args.credentialId ||
        previous.tool !== args.tool ||
        previous.argumentsJson !== validated.argumentsJson
      )
        throw new ConvexError("Request identifier was already used for different arguments.");
      return previous._id;
    }
    const invocationId = await ctx.db.insert("mcpInvocations", {
      ...args,
      ...validated,
      workspaceId: credential.workspaceId,
      requesterId: user._id,
      credentialRevision: credential.revision,
      status: "pending",
      resultJson: null,
      error: null,
    });
    await audit(ctx, credential, user._id, "preview", invocationId);
    if (conversation) {
      const shared = {
        workspaceId: conversation.workspaceId,
        conversationId: conversation._id,
        requestId: `mcp_${invocationId}`,
        status: "completed" as const,
        citations: [],
        context: conversation.context,
        contextTruncated: false,
        provider: "plane-mcp-preview",
        model: "",
        inputTokens: null,
        outputTokens: null,
        error: null,
      };
      await ctx.db.insert("assistantMessages", {
        ...shared,
        role: "user",
        content: `${args.tool}\n${validated.argumentsJson}`,
      });
      await ctx.db.insert("assistantMessages", {
        ...shared,
        role: "assistant",
        content: validated.write
          ? "Review and approve the external change before execution."
          : "Review and run the MCP request.",
        mcpInvocationId: invocationId,
      });
      await ctx.db.patch(conversation._id, { lastActivityAt: Date.now() });
    }
    return invocationId;
  },
});
export const get = query({
  args: { invocationId: v.id("mcpInvocations") },
  handler: async (ctx, args) => (await requireInvocation(ctx, args.invocationId)).invocation,
});
export const list = query({
  args: { credentialId: v.id("mcpCredentials"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user } = await requireCredential(ctx, args.credentialId, "use");
    return ctx.db
      .query("mcpInvocations")
      .withIndex("by_credential_requester", (q) => q.eq("credentialId", args.credentialId).eq("requesterId", user._id))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const cancel = mutation({
  args: { invocationId: v.id("mcpInvocations") },
  handler: async (ctx, args) => {
    const { credential, user, invocation } = await requireInvocation(ctx, args.invocationId);
    if (invocation.status !== "pending") throw new ConvexError("Only pending invocations can be cancelled.");
    await ctx.db.patch(invocation._id, { status: "cancelled" });
    await audit(ctx, credential, user._id, "cancel", invocation._id);
  },
});
export const claim = internalMutation({
  args: { invocationId: v.id("mcpInvocations") },
  handler: async (ctx, args) => {
    const { credential, user, invocation } = await requireInvocation(ctx, args.invocationId);
    if (invocation.status !== "pending")
      throw new ConvexError("Invocation has already been confirmed or cancelled. Do not retry external writes.");
    if (credential.status !== "active" || credential.revision !== invocation.credentialRevision)
      throw new ConvexError("Credential changed. Request a new preview.");
    validateTool(invocation.tool, invocation.argumentsJson, credential);
    await ctx.db.patch(invocation._id, { status: "dispatching" });
    await audit(ctx, credential, user._id, "confirm", invocation._id);
    return invocation;
  },
});
export const dispatch = internalQuery({
  args: { invocationId: v.id("mcpInvocations") },
  handler: async (ctx, args) => {
    const { credential, invocation } = await requireInvocation(ctx, args.invocationId);
    if (
      invocation.status !== "dispatching" ||
      credential.status !== "active" ||
      credential.revision !== invocation.credentialRevision
    )
      throw new ConvexError("Invocation is no longer authorized.");
    const secret = await ctx.db
      .query("mcpSecrets")
      .withIndex("by_credential", (q) => q.eq("credentialId", credential._id))
      .unique();
    if (!secret) throw new ConvexError("Credential secret is unavailable.");
    return { invocation, credential, secret };
  },
});
export const finish = internalMutation({
  args: { invocationId: v.id("mcpInvocations"), resultJson: v.string() },
  handler: async (ctx, args) => {
    const { credential, user, invocation } = await requireInvocation(ctx, args.invocationId);
    if (
      invocation.status !== "dispatching" ||
      credential.status !== "active" ||
      credential.revision !== invocation.credentialRevision
    )
      throw new ConvexError("Invocation is no longer authorized.");
    if (args.resultJson.length > 1000000) throw new ConvexError("Tool result exceeded the size limit.");
    await ctx.db.patch(invocation._id, { status: "completed", resultJson: args.resultJson });
    await audit(ctx, credential, user._id, "use", invocation._id);
  },
});
export const fail = internalMutation({
  args: { invocationId: v.id("mcpInvocations"), ambiguous: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const invocation = await ctx.db.get(args.invocationId);
    if (!invocation || invocation.requesterId !== user._id) throw new ConvexError("Invocation not found.");
    if (invocation.status !== "dispatching") return;
    const credential = await ctx.db.get(invocation.credentialId);
    if (!credential) throw new ConvexError("Credential not found.");
    const status = args.ambiguous && invocation.write ? "unknown" : "failed";
    await ctx.db.patch(invocation._id, {
      status,
      error:
        status === "unknown"
          ? "The external write may have completed. Verify the remote system before creating another invocation."
          : "The MCP request failed. Check access and integration configuration.",
    });
    await audit(ctx, credential, user._id, status, invocation._id);
  },
});

export const capabilities = query({
  args: { credentialId: v.id("mcpCredentials") },
  handler: async (ctx, args) => {
    const { credential, canInvokeMcp } = await requireCredential(ctx, args.credentialId, "use");
    let configured = false;
    try {
      endpoint();
      configured = true;
    } catch {
      /* A missing or invalid owner configuration exposes no usable transport. */
    }
    return { tools: canInvokeMcp ? toolCapabilities(credential) : [], configured: canInvokeMcp && configured };
  },
});

export async function conversationResult(
  ctx: QueryCtx,
  invocationId: Id<"mcpInvocations">,
  conversationId: Id<"assistantConversations">,
  userId: Id<"users">
) {
  const invocation = await ctx.db.get(invocationId);
  if (!invocation || invocation.conversationId !== conversationId || invocation.requesterId !== userId) return null;
  const credential = await ctx.db.get(invocation.credentialId);
  if (!credential || !(await credentialMetadataAccess(ctx, credential, userId))?.canUse) return null;
  return invocation.resultJson;
}
