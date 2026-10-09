import { defineTable } from "convex/server";
import { v } from "convex/values";
import { z } from "zod/v4";
import { zodToConvexFields, zodToConvex } from "convex-helpers/server/zod4";
import { apiIdSchema } from "../identity/schema";
import { encryptedFields } from "../mcp/schema";
import { moduleApiField } from "../modules/schema";
import { projectJson } from "../projects/schema";

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
// The worker publishes classifications, never its receiver body, headers or credentials.
export const webhookTransportOutcome = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("http"), status: z.int().min(100).max(599) }),
  z.strictObject({ kind: z.enum(["transport", "blocked"]) }),
]);
export const webhookOutcome = webhookTransportOutcome.or(
  z.strictObject({ kind: z.enum(["snapshot_failed", "uncertain", "cancelled"]) })
);
// The public JSON parser cannot preserve arbitrary-precision integer literals.
// Refuse these compared activity values until that representation boundary is owned.
export const moduleWebhookValue = projectJson.refine((value) => {
  const values = [value];
  for (const item of values) {
    if (typeof item === "number" && Number.isInteger(item) && !Number.isSafeInteger(item)) return false;
    if (item !== null && typeof item === "object") for (const child of Object.values(item)) values.push(child);
  }
  return true;
});
// Module activity compares raw JSON like the inherited model_activity producer.
// Python treats booleans as 0/1, arrays in order and object keys independent of order.
export function webhookValueEqual(before: z.infer<typeof projectJson>, after: z.infer<typeof projectJson>): boolean {
  if (typeof before === "boolean") return webhookValueEqual(Number(before), after);
  if (typeof after === "boolean") return webhookValueEqual(before, Number(after));
  if (before === after) return true;
  if (Array.isArray(before) && Array.isArray(after))
    return before.length === after.length && before.every((value, index) => webhookValueEqual(value, after[index]));
  if (
    before &&
    after &&
    typeof before === "object" &&
    typeof after === "object" &&
    !Array.isArray(before) &&
    !Array.isArray(after)
  )
    return (
      Object.keys(before).length === Object.keys(after).length &&
      Object.entries(before).every(([key, value]) => Object.hasOwn(after, key) && webhookValueEqual(value, after[key]))
    );
  return false;
}
export const moduleWebhookActivity = v.union(
  v.object({ action: v.literal("created"), field: v.null(), oldValueJson: v.null(), newValueJson: v.null() }),
  v.object({
    action: v.literal("updated"),
    field: zodToConvex(moduleApiField),
    oldValueJson: v.string(),
    newValueJson: v.string(),
  })
);
export const moduleWebhookEvent = v.object({
  eventId: zodToConvex(apiIdSchema),
  workspaceId: v.id("workspaces"),
  projectId: v.id("projects"),
  moduleId: v.id("modules"),
  actorId: v.id("users"),
  activity: moduleWebhookActivity,
});
const deliveryFields = {
  workspaceId: v.id("workspaces"),
  webhookId: v.id("webhooks"),
  webhookRevision: v.number(),
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
};
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
  webhookDeliveries: defineTable(
    v.union(
      v.object({ ...deliveryFields, taskId: v.id("tasks"), eventId: v.id("taskEvents") }),
      v.object({ ...deliveryFields, ...moduleWebhookEvent.fields, activity: v.union(moduleWebhookActivity, v.null()) })
    )
  )
    .index("by_storage", ["payloadStorageId"])
    .index("by_event_webhook", ["eventId", "webhookId"])
    .index("by_workspace_webhook", ["workspaceId", "webhookId"]),
};
