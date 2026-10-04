import { ConvexError, v } from "convex/values";
import type { Infer } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireWorkspace } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { webhookInput, webhookFields, webhookEvent, webhookUrlLimit, encryptedFields } from "./schema";

async function requireAdmin(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  const access = await requireWorkspace(ctx, workspaceId);
  if (access.member.role !== "admin") throw new ConvexError("Only workspace administrators can manage webhooks.");
  return access;
}
async function requireWebhook(ctx: QueryCtx, workspaceId: Id<"workspaces">, webhookId: Id<"webhooks">) {
  const access = await requireAdmin(ctx, workspaceId);
  const webhook = await ctx.db.get(webhookId);
  if (!webhook || webhook.workspaceId !== workspaceId || webhook.deletedAt !== null)
    throw new ConvexError("Webhook not found.");
  return { ...access, webhook };
}
function requireRevision(webhook: Doc<"webhooks">, expectedRevision: number) {
  if (webhook.revision !== expectedRevision)
    throw new ConvexError("Webhook changed. Reopen its latest settings before saving.");
}
export function metadata(webhook: Doc<"webhooks">) {
  return {
    available: webhook.deletedAt === null,
    _id: webhook._id,
    _creationTime: webhook._creationTime,
    url: webhook.url,
    events: webhook.events,
    isActive: webhook.isActive,
    revision: webhook.revision,
    updatedAt: webhook.updatedAt,
  };
}
async function validate(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  input: Infer<typeof fields>,
  webhookId?: Id<"webhooks">
) {
  const parsed = webhookInput.safeParse(input);
  if (!parsed.success)
    throw new ConvexError("Enter an HTTP or HTTPS URL up to 1024 characters and valid webhook events.");
  const existing = await ctx.db
    .query("webhooks")
    .withIndex("by_workspace_url_deleted", (q) =>
      q.eq("workspaceId", workspaceId).eq("url", parsed.data.url).eq("deletedAt", null)
    )
    .unique();
  if (existing && existing._id !== webhookId) throw new ConvexError("A webhook with this URL already exists.");
  return { ...parsed.data, events: [...new Set(parsed.data.events)] };
}
const fields = v.object(webhookFields);
export const list = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.workspaceId);
    const page = await ctx.db
      .query("webhooks")
      .withIndex("by_workspace_deleted", (q) => q.eq("workspaceId", args.workspaceId).eq("deletedAt", null))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    return { ...page, page: page.page.map(metadata) };
  },
});
export const get = query({
  args: { workspaceId: v.id("workspaces"), webhookId: v.string() },
  handler: async (ctx, args) => {
    const webhookId = ctx.db.normalizeId("webhooks", args.webhookId);
    if (!webhookId) throw new ConvexError("Webhook not found.");
    await requireAdmin(ctx, args.workspaceId);
    const webhook = await ctx.db.get(webhookId);
    if (!webhook || webhook.workspaceId !== args.workspaceId) throw new ConvexError("Webhook not found.");
    return metadata(webhook);
  },
});
export const options = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.workspaceId);
    return {
      events: webhookEvent.options,
      defaults: { url: "", events: webhookEvent.options, isActive: true },
      urlMaxLength: webhookUrlLimit,
    };
  },
});
export const authorizeCreate = internalQuery({
  args: { workspaceId: v.id("workspaces"), input: fields },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.workspaceId);
    await validate(ctx, args.workspaceId, args.input);
  },
});
export const createEncrypted = internalMutation({
  args: { workspaceId: v.id("workspaces"), input: fields, ...encryptedFields },
  handler: async (ctx, { workspaceId, input, ...secret }) => {
    const { user } = await requireAdmin(ctx, workspaceId);
    const data = await validate(ctx, workspaceId, input);
    const id = await ctx.db.insert("webhooks", {
      workspaceId,
      createdBy: user._id,
      ...data,
      ...secret,
      revision: 0,
      updatedAt: Date.now(),
      deletedAt: null,
    });
    return metadata((await ctx.db.get(id))!);
  },
});
export const update = mutation({
  args: { workspaceId: v.id("workspaces"), webhookId: v.id("webhooks"), expectedRevision: v.number(), input: fields },
  handler: async (ctx, args) => {
    const { webhook } = await requireWebhook(ctx, args.workspaceId, args.webhookId);
    requireRevision(webhook, args.expectedRevision);
    const data = await validate(ctx, args.workspaceId, args.input, webhook._id);
    const updatedAt = Date.now();
    await ctx.db.patch(webhook._id, { ...data, revision: webhook.revision + 1, updatedAt });
    return metadata({ ...webhook, ...data, revision: webhook.revision + 1, updatedAt });
  },
});
export const setActive = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    webhookId: v.id("webhooks"),
    expectedRevision: v.number(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { webhook } = await requireWebhook(ctx, args.workspaceId, args.webhookId);
    requireRevision(webhook, args.expectedRevision);
    if (webhook.isActive === args.isActive) return;
    await ctx.db.patch(webhook._id, { isActive: args.isActive, revision: webhook.revision + 1, updatedAt: Date.now() });
  },
});
export const remove = mutation({
  args: { workspaceId: v.id("workspaces"), webhookId: v.id("webhooks"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const { webhook } = await requireWebhook(ctx, args.workspaceId, args.webhookId);
    requireRevision(webhook, args.expectedRevision);
    await ctx.db.patch(webhook._id, { deletedAt: Date.now(), isActive: false, revision: webhook.revision + 1 });
  },
});
export const authorizeRotate = internalQuery({
  args: { workspaceId: v.id("workspaces"), webhookId: v.id("webhooks"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const { webhook } = await requireWebhook(ctx, args.workspaceId, args.webhookId);
    requireRevision(webhook, args.expectedRevision);
  },
});
export const rotateEncrypted = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    webhookId: v.id("webhooks"),
    expectedRevision: v.number(),
    ...encryptedFields,
  },
  handler: async (ctx, { workspaceId, webhookId, expectedRevision, ...secret }) => {
    const { webhook } = await requireWebhook(ctx, workspaceId, webhookId);
    requireRevision(webhook, expectedRevision);
    const updatedAt = Date.now();
    await ctx.db.patch(webhook._id, { ...secret, revision: webhook.revision + 1, updatedAt });
    return metadata({ ...webhook, revision: webhook.revision + 1, updatedAt });
  },
});
