import { ConvexError, v } from "convex/values";
import type { Infer } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { zodToConvex } from "convex-helpers/server/zod4";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireWorkspace } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { internal } from "../_generated/api";
import { apiIdSchema } from "../identity/schema";
import { externalUserLite } from "../identity/external";
import { taskWire } from "../projects/external";
import { projectJson } from "../projects/schema";
import { webhookInput, webhookFields, webhookEvent, webhookUrlLimit, encryptedFields, webhookOutcome } from "./schema";

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
      apiId: crypto.randomUUID(),
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

// This authority belongs to the workspace's configured integration, not its creator's session.
async function currentSubscription(ctx: QueryCtx, delivery: Doc<"webhookDeliveries">) {
  const [webhook, task, workspace] = await Promise.all([
    ctx.db.get(delivery.webhookId),
    ctx.db.get(delivery.taskId),
    ctx.db.get(delivery.workspaceId),
  ]);
  if (
    !webhook ||
    webhook.workspaceId !== delivery.workspaceId ||
    webhook.deletedAt !== null ||
    !webhook.isActive ||
    webhook.revision !== delivery.webhookRevision ||
    !webhook.events.includes("issue") ||
    !task ||
    task.workspaceId !== delivery.workspaceId ||
    task.deletedAt !== null ||
    !workspace ||
    workspace.deletedAt != null
  )
    return null;
  const project = await ctx.db.get(task.projectId);
  if (!project || project.workspaceId !== workspace._id || project.deletedAt !== null) return null;
  return { webhook, task, workspace, project };
}

export const fanout = internalMutation({
  args: { eventId: v.id("taskEvents"), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { eventId, cursor }): Promise<void> => {
    const event = await ctx.db.get(eventId);
    if (!event || !event.changes?.some((change) => change.field === "title" && change.before !== change.after)) return;
    const task = await ctx.db.get(event.taskId);
    if (
      !task ||
      task.deletedAt !== null ||
      task.workspaceId !== event.workspaceId ||
      task.projectId !== event.projectId
    )
      return;
    const page = await ctx.db
      .query("webhooks")
      .withIndex("by_workspace_deleted", (q) => q.eq("workspaceId", event.workspaceId).eq("deletedAt", null))
      .paginate({ cursor, numItems: 1, maximumRowsRead: 1, maximumBytesRead: 1_048_576 });
    await Promise.all(
      page.page.map(async (webhook) => {
        if (!webhook.isActive || !webhook.events.includes("issue")) return;
        const previous = await ctx.db
          .query("webhookDeliveries")
          .withIndex("by_event_webhook", (q) => q.eq("eventId", eventId).eq("webhookId", webhook._id))
          .unique();
        if (previous) return;
        const deliveryId = await ctx.db.insert("webhookDeliveries", {
          workspaceId: event.workspaceId,
          eventId,
          taskId: task._id,
          webhookId: webhook._id,
          webhookRevision: webhook.revision,
          apiId: crypto.randomUUID(),
          phase: "pending",
          payloadStorageId: null,
          attempts: [],
        });
        await ctx.scheduler.runAfter(0, internal.webhooks.index.claim, { deliveryId, expectedAttempt: 0 });
      })
    );
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.webhooks.index.fanout, { eventId, cursor: page.continueCursor });
  },
});

const attemptArgs = { deliveryId: v.id("webhookDeliveries"), expectedAttempt: v.number() };
export const claim = internalMutation({
  args: attemptArgs,
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (
      !delivery ||
      delivery.phase !== "pending" ||
      delivery.attempts.length !== args.expectedAttempt ||
      delivery.attempts.length >= 6
    )
      return;
    if (!(await currentSubscription(ctx, delivery))) {
      if (delivery.payloadStorageId && (await ctx.db.system.get(delivery.payloadStorageId)))
        await ctx.storage.delete(delivery.payloadStorageId);
      await ctx.db.patch(delivery._id, { phase: "cancelled", payloadStorageId: null });
      return;
    }
    const attempt = delivery.attempts.length + 1;
    await ctx.db.patch(delivery._id, {
      phase: "sending",
      attempts: [...delivery.attempts, { startedAt: Date.now(), finishedAt: null, outcome: null }],
    });
    // Interrupted actions are not transport failures: retain an uncertain outcome without automatic replay.
    await ctx.scheduler.runAfter(120_000, internal.webhooks.index.finish, {
      deliveryId: delivery._id,
      expectedAttempt: attempt,
      outcome: { kind: "uncertain" },
    });
    await ctx.scheduler.runAfter(0, internal.webhooks.actions.send, {
      deliveryId: delivery._id,
      expectedAttempt: attempt,
    });
  },
});

export const sending = internalQuery({
  args: attemptArgs,
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery || delivery.phase !== "sending" || delivery.attempts.length !== args.expectedAttempt) return null;
    const current = await currentSubscription(ctx, delivery);
    return current ? { delivery, ...current } : null;
  },
});

export const snapshot = internalQuery({
  args: attemptArgs,
  handler: async (ctx, args): Promise<string | null> => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery || delivery.phase !== "sending" || delivery.attempts.length !== args.expectedAttempt) return null;
    const current = await currentSubscription(ctx, delivery);
    if (!current) return null;
    const event = await ctx.db.get(delivery.eventId);
    if (
      !event ||
      event.taskId !== current.task._id ||
      event.projectId !== current.project._id ||
      event.workspaceId !== current.workspace._id
    )
      throw new ConvexError("Webhook delivery lost its Task event.");
    const change = event.changes?.find((item) => item.field === "title");
    const actor = await ctx.db.get(event.actorId);
    const origin = process.env.CONVEX_SITE_URL;
    if (!change || change.before === change.after || !actor || !origin)
      throw new ConvexError("Webhook snapshot is unavailable.");
    const assetOrigin = new URL(origin).origin;
    return JSON.stringify({
      event: "issue",
      action: "updated",
      webhook_id: apiIdSchema.parse(current.webhook.apiId),
      workspace_id: apiIdSchema.parse(current.workspace.apiId),
      workspace_slug: current.workspace.slug,
      data: projectJson.parse(
        await taskWire(ctx, current.task, current, null, ["state", "labels", "assignees"], assetOrigin, "webhook")
      ),
      activity: {
        field: "name",
        old_value: change.before,
        new_value: change.after,
        actor: await externalUserLite(ctx, actor, assetOrigin, current.workspace),
        old_identifier: null,
        new_identifier: null,
      },
    });
  },
});

export const capture = internalMutation({
  args: { ...attemptArgs, storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery || delivery.phase !== "sending" || delivery.attempts.length !== args.expectedAttempt) return false;
    if (!(await currentSubscription(ctx, delivery))) return false;
    if (!(await ctx.db.system.get(args.storageId))) throw new ConvexError("Webhook snapshot bytes are missing.");
    if (delivery.payloadStorageId === null) await ctx.db.patch(delivery._id, { payloadStorageId: args.storageId });
    return true;
  },
});

export const finish = internalMutation({
  args: { ...attemptArgs, outcome: zodToConvex(webhookOutcome) },
  handler: async (ctx, args): Promise<void> => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery || delivery.phase !== "sending" || delivery.attempts.length !== args.expectedAttempt) return;
    const outcome = webhookOutcome.parse(args.outcome);
    const attempts = delivery.attempts.map((attempt, index) =>
      index === delivery.attempts.length - 1 ? { ...attempt, finishedAt: Date.now(), outcome } : attempt
    );
    const current = await currentSubscription(ctx, delivery);
    if (outcome.kind === "transport" && current && attempts.length < 6) {
      await ctx.db.patch(delivery._id, { phase: "pending", attempts });
      await ctx.scheduler.runAfter(
        Math.floor(Math.random() * 600_000 * 2 ** (attempts.length - 1)),
        internal.webhooks.index.claim,
        { deliveryId: delivery._id, expectedAttempt: attempts.length }
      );
      return;
    }
    if (outcome.kind === "transport" && current && attempts.length === 6)
      await ctx.db.patch(current.webhook._id, {
        isActive: false,
        revision: current.webhook.revision + 1,
        updatedAt: Date.now(),
      });
    if (delivery.payloadStorageId && (await ctx.db.system.get(delivery.payloadStorageId)))
      await ctx.storage.delete(delivery.payloadStorageId);
    await ctx.db.patch(delivery._id, {
      attempts,
      payloadStorageId: null,
      phase:
        outcome.kind === "cancelled"
          ? "cancelled"
          : outcome.kind === "uncertain"
            ? "uncertain"
            : !current
              ? "cancelled"
              : outcome.kind === "http"
                ? "completed"
                : "failed",
    });
  },
});

export const history = query({
  args: { workspaceId: v.id("workspaces"), webhookId: v.id("webhooks"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.workspaceId);
    const page = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_workspace_webhook", (q) => q.eq("workspaceId", args.workspaceId).eq("webhookId", args.webhookId))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    return {
      ...page,
      page: page.page.map(({ _id, _creationTime, apiId, phase, attempts }) => ({
        _id,
        _creationTime,
        apiId,
        phase,
        attempts,
      })),
    };
  },
});
