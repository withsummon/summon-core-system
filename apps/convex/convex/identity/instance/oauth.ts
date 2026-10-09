import { ConvexError, compareValues, v } from "convex/values";
import { z } from "zod/v4";
import { zodToConvex } from "convex-helpers/server/zod4";
import { internalMutation, mutation, query, type QueryCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import { requireInstanceAdmin } from "./access";
import { oauthConfiguration, oauthConfigurations, oauthProviderIds } from "../oauth/config";
import { operatorAuthentication } from "./authentication";
import { encrypt, decrypt } from "../../mcp/crypto";

export async function operatorOAuth(env: Record<string, string | undefined>) {
  const configurations = [];
  for (const configuration of oauthConfigurations(env))
    configurations.push(
      encrypt(configuration.clientSecret).then((clientSecret) => ({ ...configuration, clientSecret }))
    );
  return Promise.all(configurations);
}
export function oauthForInstance(instance: Doc<"instanceAuthority"> | null) {
  if (!instance) return { adoptionRequired: false, configurations: oauthConfigurations(process.env) };
  if (instance.oauth === undefined) return { adoptionRequired: true, configurations: [] };
  return { adoptionRequired: false, configurations: instance.oauth };
}
export async function currentOAuth(ctx: QueryCtx) {
  return oauthForInstance(
    await ctx.db
      .query("instanceAuthority")
      .withIndex("by_key", (q) => q.eq("key", "instance"))
      .unique()
  );
}
export async function runtimeOAuth(ctx: QueryCtx) {
  const instance = await ctx.db
    .query("instanceAuthority")
    .withIndex("by_key", (q) => q.eq("key", "instance"))
    .unique();
  if (!instance) {
    const policy = operatorAuthentication(process.env);
    return {
      adoptionRequired: false,
      configurations: oauthConfigurations(process.env).filter(({ id }) => policy.providers[id]),
    };
  }
  if (instance.oauth === undefined) return { adoptionRequired: true, configurations: [] };
  const configurations = [];
  for (const configuration of instance.oauth) {
    if (instance.authentication?.providers[configuration.id] === true)
      configurations.push(
        decrypt(configuration.clientSecret).then((clientSecret) => ({ ...configuration, clientSecret }))
      );
  }
  return { adoptionRequired: false, configurations: await Promise.all(configurations) };
}
export const get = query({
  args: { provider: zodToConvex(z.enum(oauthProviderIds)) },
  handler: async (ctx, args) => {
    const { instance } = await requireInstanceAdmin(ctx);
    const { adoptionRequired, configurations } = oauthForInstance(instance);
    const configuration = configurations.find(({ id }) => id === args.provider);
    return {
      revision: instance.revision,
      adoptionRequired,
      configuration: configuration
        ? {
            id: configuration.id,
            clientId: configuration.clientId,
            sync: configuration.sync,
            host: "host" in configuration ? configuration.host : null,
            organization: "organization" in configuration ? (configuration.organization ?? null) : null,
            credentialPresent: true,
          }
        : null,
      callbackUrl: new URL(`/api/auth/oauth2/callback/${args.provider}`, process.env.CONVEX_SITE_URL).href,
    };
  },
});
// A blank replacement preserves the encrypted credential. Removal is a distinct
// command, never inferred from a cleared password input.
export const save = mutation({
  args: {
    expectedRevision: v.number(),
    provider: zodToConvex(z.enum(oauthProviderIds)),
    configuration: v.union(
      v.null(),
      v.object({
        clientId: v.string(),
        clientSecret: v.optional(v.string()),
        sync: v.boolean(),
        host: v.optional(v.string()),
        organization: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { instance } = await requireInstanceAdmin(ctx);
    if (instance.revision !== args.expectedRevision)
      throw new ConvexError("Instance settings changed. Review the latest settings before saving.");
    if (instance.oauth === undefined) throw new ConvexError("OAuth configuration requires explicit operator adoption.");
    const previous = instance.oauth.find(({ id }) => id === args.provider);
    const others = instance.oauth.filter(({ id }) => id !== args.provider);
    let oauth = others;
    if (args.configuration) {
      const secret = args.configuration.clientSecret || (previous && (await decrypt(previous.clientSecret)));
      const parsed = oauthConfiguration.safeParse({ ...args.configuration, id: args.provider, clientSecret: secret });
      if (!parsed.success) throw new ConvexError(parsed.error.issues[0].message);
      const next = {
        ...parsed.data,
        clientSecret: args.configuration.clientSecret
          ? await encrypt(parsed.data.clientSecret)
          : previous?.clientSecret,
      };
      if (!next.clientSecret) throw new ConvexError("Enter a client secret.");
      oauth = [...others, { ...next, clientSecret: next.clientSecret }];
    }
    oauth.sort((a, b) => oauthProviderIds.indexOf(a.id) - oauthProviderIds.indexOf(b.id));
    if (compareValues(oauth, instance.oauth) === 0) return instance.revision;
    const revision = instance.revision + 1;
    await ctx.db.patch(instance._id, { oauth, revision });
    return revision;
  },
});
// Missing-only adoption must be explicitly reviewed on both hosts, then a
// second pass must change zero before requiring oauth and removing this RPC.
export const adopt = internalMutation({
  args: { expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const { instance } = await requireInstanceAdmin(ctx);
    if (instance.revision !== args.expectedRevision)
      throw new ConvexError("Instance settings changed. Review the latest settings before adoption.");
    if (instance.oauth !== undefined) return { changed: 0, revision: instance.revision };
    const oauth = await operatorOAuth(process.env);
    const revision = instance.revision + 1;
    await ctx.db.patch(instance._id, { oauth, revision });
    return { changed: 1, revision };
  },
});
