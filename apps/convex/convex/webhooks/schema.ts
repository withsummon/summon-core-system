import { defineTable } from "convex/server";
import { v } from "convex/values";
import { z } from "zod/v4";
import { zodToConvexFields } from "convex-helpers/server/zod4";

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
export const webhookTables = {
  webhooks: defineTable({
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
};
