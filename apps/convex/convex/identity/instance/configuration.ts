import { signInPolicy } from "../signin_policy";
import { ConvexError, v } from "convex/values";
import { zodToConvexFields } from "convex-helpers/server/zod4";
import { mutation, query } from "../../_generated/server";
import { requireInstanceAdmin } from "./access";
import { mailConfiguration } from "../mail/config";
import { oauthConfigurations } from "../oauth/config";
import { instanceGeneral } from "../schema";
export const get = query({
  args: {},
  handler: async (ctx) => {
    const { instance } = await requireInstanceAdmin(ctx);
    const firstAdmin = await ctx.db
      .query("instanceAdmins")
      .withIndex("by_instance", (q) => q.eq("instanceId", instance._id))
      .order("desc")
      .first();
    const administrator = firstAdmin ? await ctx.db.get(firstAdmin.userId) : null;
    return {
      initializedAt: instance.initializedAt,
      instanceName: instance.instanceName,
      telemetryEnabled: instance.telemetryEnabled,
      instanceId: instance.instanceId,
      revision: instance.revision,
      administratorEmail: administrator?.email ?? null,
      ...workspaceCreationPolicy(),
      passwordSignIn: signInPolicy(process.env).password,
      mailConfigured: mailConfiguration(process.env) !== null,
      oauthProviders: oauthConfigurations(process.env).map((provider) => provider.id),
    };
  },
});
export const save = mutation({
  args: { expectedRevision: v.number(), ...zodToConvexFields(instanceGeneral.shape) },
  handler: async (ctx, args) => {
    const { instance } = await requireInstanceAdmin(ctx);
    const general = instanceGeneral.parse(args);
    if (args.expectedRevision !== instance.revision)
      throw new ConvexError("Instance settings changed. Review the latest settings before saving.");
    if (general.instanceName === instance.instanceName && general.telemetryEnabled === instance.telemetryEnabled)
      return instance.revision;
    const revision = instance.revision + 1;
    await ctx.db.patch(instance._id, { ...general, revision });
    return revision;
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
