import { defineTable } from "convex/server";
import { v } from "convex/values";
import { z } from "zod/v4";
import { zodToConvexFields, zodToConvex } from "convex-helpers/server/zod4";
import { apiIdSchema } from "../identity/schema";

export const webhookUrlLimit = 1024;
export const webhookEvent = z.enum(["project", "cycle", "issue", "module", "issue_comment"]);
export const webhookInput = z.strictObject({
  url: z
    .url({ protocol: /^https?$/ })
    .trim()
    .max(webhookUrlLimit),
  events: z.array(webhookEvent).max(webhookEvent.options.length),
  isActive: z.boolean(),
});
export const webhookFields = zodToConvexFields(webhookInput.shape);
export const encryptedFields = { ciphertext: v.string(), nonce: v.string(), keyVersion: v.literal(2) };
// The worker publishes classifications, never its receiver body, headers or credentials.
export const webhookTransportOutcome = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("http"), status: z.int().min(100).max(599) }),
  z.strictObject({ kind: z.enum(["transport", "blocked"]) }),
]);
export const webhookOutcome = webhookTransportOutcome.or(
  z.strictObject({ kind: z.enum(["snapshot_failed", "uncertain", "cancelled"]) })
);
export const webhookTables = {
  webhooks: defineTable({
    apiId: v.optional(zodToConvex(apiIdSchema)),
    workspaceId: v.id("workspaces"),
    createdBy: v.id("users"),
    ...webhookFields,
    ...encryptedFields,
    revision: v.number(),
    updatedAt: v.number(),
    deletedAt: v.union(v.number(), v.null()),
  })
    .index("by_workspace_deleted", ["workspaceId", "deletedAt"])
    .index("by_workspace_url_deleted", ["workspaceId", "url", "deletedAt"]),
  webhookDeliveries: defineTable({
    workspaceId: v.id("workspaces"),
    webhookId: v.id("webhooks"),
    webhookRevision: v.number(),
    taskId: v.id("tasks"),
    eventId: v.id("taskEvents"),
    apiId: zodToConvex(apiIdSchema),
    phase: v.union(
      v.literal("pending"),
      v.literal("sending"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
      v.literal("uncertain")
    ),
    payloadStorageId: v.union(v.id("_storage"), v.null()),
    attempts: v.array(
      v.object({
        startedAt: v.number(),
        finishedAt: v.union(v.number(), v.null()),
        outcome: v.union(zodToConvex(webhookOutcome), v.null()),
      })
    ),
  })
    .index("by_storage", ["payloadStorageId"])
    .index("by_event_webhook", ["eventId", "webhookId"])
    .index("by_workspace_webhook", ["workspaceId", "webhookId"]),
};
