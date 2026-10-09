import { ConvexError, v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { encrypt, decrypt } from "../mcp/crypto";
import { worker } from "../automation/generate";
import type { metadata } from "./index";
import { webhookFields, webhookTransportOutcome } from "./schema";

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

export const send = internalAction({
  args: { deliveryId: v.id("webhookDeliveries"), expectedAttempt: v.number() },
  handler: async (ctx, args): Promise<void> => {
    let signature: string;
    let payload: string;
    try {
      const initial = await ctx.runQuery(internal.webhooks.index.sending, args);
      if (!initial) {
        await ctx.runMutation(internal.webhooks.index.finish, { ...args, outcome: { kind: "cancelled" } });
        return;
      }
      if (initial.delivery.payloadStorageId === null) {
        const snapshot = await ctx.runQuery(internal.webhooks.index.snapshot, args);
        if (snapshot === null) {
          await ctx.runMutation(internal.webhooks.index.finish, { ...args, outcome: { kind: "cancelled" } });
          return;
        }
        const storageId = await ctx.storage.store(new Blob([snapshot], { type: "application/json" }));
        // An ambiguous adoption ACK must not delete bytes the mutation may have adopted.
        if (!(await ctx.runMutation(internal.webhooks.index.capture, { ...args, storageId }))) {
          await ctx.runMutation(internal.webhooks.index.finish, { ...args, outcome: { kind: "cancelled" } });
          return;
        }
      }
      const current = await ctx.runQuery(internal.webhooks.index.sending, args);
      if (!current || current.delivery.payloadStorageId === null) {
        await ctx.runMutation(internal.webhooks.index.finish, { ...args, outcome: { kind: "cancelled" } });
        return;
      }
      const blob = await ctx.storage.get(current.delivery.payloadStorageId);
      if (!blob) throw new ConvexError("Webhook snapshot bytes are missing.");
      payload = await blob.text();
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(await decrypt(current.webhook)),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
      signature = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    } catch {
      await ctx.runMutation(internal.webhooks.index.finish, { ...args, outcome: { kind: "snapshot_failed" } });
      return;
    }
    const current = await ctx.runQuery(internal.webhooks.index.sending, args);
    if (!current || current.delivery.payloadStorageId === null) {
      await ctx.runMutation(internal.webhooks.index.finish, { ...args, outcome: { kind: "cancelled" } });
      return;
    }
    try {
      const outcome = webhookTransportOutcome.parse(
        await worker("/webhook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: current.webhook.url,
            body: payload,
            delivery_id: current.delivery.apiId,
            signature,
          }),
        })
      );
      await ctx.runMutation(internal.webhooks.index.finish, { ...args, outcome });
    } catch {
      // A missing/invalid worker ACK cannot prove whether the receiver accepted the signed bytes.
      await ctx.runMutation(internal.webhooks.index.finish, { ...args, outcome: { kind: "uncertain" } });
    }
  },
});
