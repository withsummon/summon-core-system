import { ConvexError, v, compareValues } from "convex/values";
import { zodToConvex } from "convex-helpers/server/zod4";
import { internalMutation, mutation, query, type QueryCtx } from "../../_generated/server";
import { instanceAuthentication, instanceAuthenticationPatch } from "../schema";
import { oauthConfigurations, oauthProviderIds } from "../oauth/config";
import { oauthForInstance } from "./oauth";
import { mailForInstance } from "./email";
import { accountRestricted } from "../deactivation/access";
import { instanceAdminAccess, requireInstanceAdmin } from "./access";
import type { Doc } from "../../_generated/dataModel";

// Before operator bootstrap, these flags are the real first-account policy.
export function operatorAuthentication(env: Record<string, string | undefined>) {
  const configured = new Set(oauthConfigurations(env).map((provider) => provider.id));
  return instanceAuthentication.parse({
    signupEnabled: (env.ENABLE_SIGNUP ?? "1") === "1",
    passwordEnabled: (env.ENABLE_EMAIL_PASSWORD ?? "1") === "1",
    magicEnabled: (env.ENABLE_MAGIC_LINK_LOGIN ?? "1") === "1",
    providers: Object.fromEntries(
      oauthProviderIds.map((id) => [
        id,
        (env[`IS_${id.toUpperCase()}_ENABLED`] ?? (configured.has(id) ? "1" : "0")) === "1",
      ])
    ),
  });
}
export function authenticationForInstance(instance: Doc<"instanceAuthority"> | null) {
  if (!instance) return operatorAuthentication(process.env);
  if (instance.authentication === undefined)
    throw new ConvexError("Instance authentication policy requires explicit operator adoption.");
  return instance.authentication;
}
export async function currentAuthentication(ctx: QueryCtx) {
  return authenticationForInstance(
    await ctx.db
      .query("instanceAuthority")
      .withIndex("by_key", (q) => q.eq("key", "instance"))
      .unique()
  );
}
export async function authenticationDecision(ctx: QueryCtx, subject?: { authId: string; email: string }) {
  if (subject) {
    const link = await ctx.db
      .query("betterAuthLinks")
      .withIndex("by_auth_id", (q) => q.eq("authId", subject.authId))
      .unique();
    const user = link && (await ctx.db.get(link.userId));
    if (
      user &&
      user.email === subject.email &&
      user.emailVerificationTime !== undefined &&
      !(await accountRestricted(ctx, user._id))
    ) {
      const { instance, member } = await instanceAdminAccess(ctx, user._id);
      return {
        authentication: authenticationForInstance(instance),
        administratorPassword: !!instance && member?.instanceId === instance._id,
      };
    }
  }
  return { authentication: await currentAuthentication(ctx), administratorPassword: false };
}
export const get = query({
  args: {},
  handler: async (ctx) => {
    const { instance } = await requireInstanceAdmin(ctx);
    const oauth = oauthForInstance(instance);
    return {
      authentication: authenticationForInstance(instance),
      revision: instance.revision,
      mailConfigured: mailForInstance(instance).configured,
      configuredProviders: oauth.configurations.map((provider) => provider.id),
      oauthAdoptionRequired: oauth.adoptionRequired,
    };
  },
});
export const save = mutation({
  args: { expectedRevision: v.number(), changes: zodToConvex(instanceAuthenticationPatch) },
  handler: async (ctx, args) => {
    const { instance } = await requireInstanceAdmin(ctx);
    if (instance.revision !== args.expectedRevision)
      throw new ConvexError("Instance settings changed. Review the latest settings before saving.");
    const current = authenticationForInstance(instance);
    const changes = args.changes;
    const authentication = {
      ...current,
      ...changes,
      providers: { ...current.providers, ...changes.providers },
    };
    if (
      !authentication.passwordEnabled &&
      !authentication.magicEnabled &&
      !Object.values(authentication.providers).some(Boolean)
    )
      throw new ConvexError("Keep at least one enabled sign-in method.");
    if (compareValues(authentication, current) === 0) return instance.revision;
    const revision = instance.revision + 1;
    await ctx.db.patch(instance._id, { authentication, revision });
    return revision;
  },
});
// Temporary missing-only adoption. Retire after both deployments have explicit
// policy coverage and a second pass changes zero; then require the stored field.
export const adopt = internalMutation({
  args: { expectedRevision: v.number(), authentication: zodToConvex(instanceAuthentication) },
  handler: async (ctx, args) => {
    const { instance } = await requireInstanceAdmin(ctx);
    if (instance.revision !== args.expectedRevision)
      throw new ConvexError("Instance settings changed. Review the latest settings before adoption.");
    const authentication = args.authentication;
    if (instance.authentication !== undefined) {
      return { changed: 0, revision: instance.revision };
    }
    const revision = instance.revision + 1;
    await ctx.db.patch(instance._id, { authentication, revision });
    return { changed: 1, revision };
  },
});
