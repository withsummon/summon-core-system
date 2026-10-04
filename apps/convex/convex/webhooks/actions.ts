import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { encrypt } from "../mcp/crypto";
import type { metadata } from "./index";
import { webhookFields } from "./schema";

export const create = action({
  args: { workspaceId: v.id("workspaces"), input: v.object(webhookFields) },
  handler: async (ctx, args): Promise<{ webhook: ReturnType<typeof metadata>; secretKey: string }> => {
    await ctx.runQuery(internal.webhooks.index.authorizeCreate, args);
    const secretKey = "plane_wh_" + crypto.randomUUID().replaceAll("-", "");
    const webhook = await ctx.runMutation(internal.webhooks.index.createEncrypted, {
      ...args,
      ...(await encrypt(secretKey)),
    });
    return { webhook, secretKey };
  },
});
export const regenerate = action({
  args: { workspaceId: v.id("workspaces"), webhookId: v.id("webhooks"), expectedRevision: v.number() },
  handler: async (ctx, args): Promise<{ webhook: ReturnType<typeof metadata>; secretKey: string }> => {
    await ctx.runQuery(internal.webhooks.index.authorizeRotate, args);
    const secretKey = "plane_wh_" + crypto.randomUUID().replaceAll("-", "");
    const webhook = await ctx.runMutation(internal.webhooks.index.rotateEncrypted, {
      ...args,
      ...(await encrypt(secretKey)),
    });
    return { webhook, secretKey };
  },
});
