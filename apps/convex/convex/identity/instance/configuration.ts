import { authenticationForInstance } from "./authentication";
import { ConvexError, v } from "convex/values";
import { zodToConvexFields } from "convex-helpers/server/zod4";
import { internalMutation, mutation, query, type QueryCtx } from "../../_generated/server";
import { requireInstanceAdmin } from "./access";
import { oauthForInstance } from "./oauth";
import { mailConfiguration } from "../mail/config";
import type { Doc } from "../../_generated/dataModel";
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
    const oauth = oauthForInstance(instance);
    return {
      initializedAt: instance.initializedAt,
      instanceName: instance.instanceName,
      telemetryEnabled: instance.telemetryEnabled,
      instanceId: instance.instanceId,
      revision: instance.revision,
      administratorEmail: administrator?.email ?? null,
      ...workspaceCreationForInstance(instance),
      passwordSignIn: authenticationForInstance(instance).passwordEnabled,
      mailConfigured: mailConfiguration(process.env) !== null,
      oauthProviders: oauth.configurations.map((provider) => provider.id),
      oauthAdoptionRequired: oauth.adoptionRequired,
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

// Before bootstrap the operator flag is authoritative. After bootstrap only
// explicit stored policy is read; no initialized-row environment fallback.
export function workspaceCreationForInstance(instance: Doc<"instanceAuthority"> | null) {
  if (!instance) return { isWorkspaceCreationDisabled: process.env.DISABLE_WORKSPACE_CREATION === "1" };
  if (instance.workspaceCreationDisabled === undefined)
    throw new ConvexError("Workspace creation policy requires explicit operator adoption.");
  return { isWorkspaceCreationDisabled: instance.workspaceCreationDisabled };
}
export async function workspaceCreationPolicy(ctx: QueryCtx) {
  const instance = await ctx.db
    .query("instanceAuthority")
    .withIndex("by_key", (q) => q.eq("key", "instance"))
    .unique();
  return workspaceCreationForInstance(instance);
}
export async function requireWorkspaceCreation(ctx: QueryCtx) {
  if ((await workspaceCreationPolicy(ctx)).isWorkspaceCreationDisabled)
    throw new ConvexError("Workspace creation is not allowed.");
}
export const availability = query({ args: {}, handler: (ctx) => workspaceCreationPolicy(ctx) });
export const saveWorkspaceCreation = mutation({
  args: { expectedRevision: v.number(), disabled: v.boolean() },
  handler: async (ctx, args) => {
    const { instance } = await requireInstanceAdmin(ctx);
    if (args.expectedRevision !== instance.revision)
      throw new ConvexError("Instance settings changed. Review the latest settings before saving.");
    if (workspaceCreationForInstance(instance).isWorkspaceCreationDisabled === args.disabled) return instance.revision;
    const revision = instance.revision + 1;
    await ctx.db.patch(instance._id, { workspaceCreationDisabled: args.disabled, revision });
    return revision;
  },
});
// Retire after both hosts have explicit policy coverage and second-pass zero;
// then require the stored field. Never infer a historical administrator/owner.
export const adoptWorkspaceCreation = internalMutation({
  args: { expectedRevision: v.number(), disabled: v.boolean() },
  handler: async (ctx, args) => {
    const { instance } = await requireInstanceAdmin(ctx);
    if (args.expectedRevision !== instance.revision)
      throw new ConvexError("Instance settings changed. Review the latest settings before adoption.");
    if (instance.workspaceCreationDisabled !== undefined) return { changed: 0, revision: instance.revision };
    const revision = instance.revision + 1;
    await ctx.db.patch(instance._id, { workspaceCreationDisabled: args.disabled, revision });
    return { changed: 1, revision };
  },
});
