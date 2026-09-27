import { ConvexError } from "convex/values";
import { query } from "../../_generated/server";
import { requireInstanceAdmin } from "./access";
import { mailConfiguration } from "../mail/config";
import { oauthConfigurations } from "../oauth/config";
export const get = query({
  args: {},
  handler: async (ctx) => {
    const { instance } = await requireInstanceAdmin(ctx);
    return {
      initializedAt: instance.initializedAt,
      ...workspaceCreationPolicy(),
      passwordSignIn: true,
      mailConfigured: mailConfiguration(process.env) !== null,
      oauthProviders: oauthConfigurations(process.env).map((provider) => provider.id),
    };
  },
});

// Same literal flag as inherited configuration. Native configuration is operator-managed env.
export function workspaceCreationPolicy() {
  return { isWorkspaceCreationDisabled: process.env.DISABLE_WORKSPACE_CREATION === "1" };
}
export function requireWorkspaceCreation() {
  if (workspaceCreationPolicy().isWorkspaceCreationDisabled)
    throw new ConvexError("Workspace creation is not allowed.");
}
export const availability = query({ args: {}, handler: () => workspaceCreationPolicy() });
