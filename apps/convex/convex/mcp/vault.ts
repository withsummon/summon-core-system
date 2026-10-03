import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { credentialFields } from "./schema";
import { encrypt } from "./crypto";
export const create = action({
  args: { workspaceId: v.id("workspaces"), ...credentialFields, secret: v.string() },
  handler: async (ctx, { secret, ...metadata }): Promise<Id<"mcpCredentials">> => {
    await ctx.runQuery(internal.mcp.credentials.authorizeCreate, metadata);
    const encrypted = await encrypt(secret);
    return ctx.runMutation(internal.mcp.credentials.createEncrypted, { ...metadata, ...encrypted });
  },
});
