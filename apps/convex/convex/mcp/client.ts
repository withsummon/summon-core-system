import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { decrypt } from "./crypto";
import { endpoint, callTool } from "./transport";
export const confirm = action({
  args: { invocationId: v.id("mcpInvocations") },
  handler: async (ctx, args): Promise<void> => {
    const url = endpoint();
    await ctx.runMutation(internal.mcp.invocations.claim, args);
    let dispatched = false;
    try {
      const { credential, invocation, secret } = await ctx.runQuery(internal.mcp.invocations.dispatch, args);
      const resultJson = await callTool({
        url,
        secret: await decrypt(secret),
        workspaceSlug: credential.remoteWorkspaceSlug,
        tool: invocation.tool,
        argumentsJson: invocation.argumentsJson,
        beforeDispatch: async () => {
          await ctx.runQuery(internal.mcp.invocations.dispatch, args);
        },
        onDispatch: () => {
          dispatched = true;
        },
      });
      await ctx.runMutation(internal.mcp.invocations.finish, { ...args, resultJson });
    } catch {
      await ctx.runMutation(internal.mcp.invocations.fail, { ...args, ambiguous: dispatched });
    }
  },
});
