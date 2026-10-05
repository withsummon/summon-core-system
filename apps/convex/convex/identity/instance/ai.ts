import { ConvexError, compareValues, v } from "convex/values";
import { z } from "zod/v4";
import { zodToConvex, zodToConvexFields } from "convex-helpers/server/zod4";
import { action, internalMutation, internalQuery, mutation, query, type QueryCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Doc } from "../../_generated/dataModel";
import { requireInstanceAdmin } from "./access";
import { encrypt, decrypt } from "../../mcp/crypto";
import {
  aiConfigured,
  aiProvider,
  aiProviderNames,
  aiSave,
  aiTestResult,
  operatorAiConfiguration,
  runtimeAiConfiguration,
  streamProvider,
  LLMError,
} from "../../assistant/provider";

export async function operatorAi(env: Record<string, string | undefined>) {
  const config = operatorAiConfiguration(env);
  return { ...config, key: config.key === null ? null : await encrypt(config.key) };
}
export function aiForInstance(instance: Doc<"instanceAuthority"> | null) {
  if (!instance) return { adoptionRequired: false, configuration: operatorAiConfiguration(process.env) };
  return { adoptionRequired: instance.ai === undefined, configuration: instance.ai ?? null };
}
export async function currentAi(ctx: QueryCtx) {
  return aiForInstance(
    await ctx.db
      .query("instanceAuthority")
      .withIndex("by_key", (q) => q.eq("key", "instance"))
      .unique()
  );
}
async function runtimeConfiguration(
  configuration: ReturnType<typeof aiForInstance>["configuration"]
): Promise<z.infer<typeof runtimeAiConfiguration> | null> {
  if (!configuration || !aiConfigured(configuration)) return null;
  if (configuration.provider === "codex") return { ...configuration, provider: configuration.provider, key: null };
  if (configuration.key === null) return null;
  return {
    ...configuration,
    provider: configuration.provider,
    key: typeof configuration.key === "string" ? configuration.key : await decrypt(configuration.key),
  };
}
export const runtime = internalQuery({
  args: {},
  handler: async (ctx) => runtimeConfiguration((await currentAi(ctx)).configuration),
});
export const get = query({
  args: {},
  handler: async (ctx) => {
    const { instance } = await requireInstanceAdmin(ctx);
    const { adoptionRequired, configuration } = aiForInstance(instance);
    return {
      revision: instance.revision,
      adoptionRequired,
      providers: aiProvider.options.map((value) => ({ value, label: aiProviderNames[value] })),
      configuration: configuration
        ? {
            provider: configuration.provider,
            model: configuration.model,
            baseUrl: configuration.baseUrl,
            timeout: configuration.timeout,
            credentialPresent: configuration.key !== null,
            codexBridgeConfigured: configuration.codexBridgeUrl !== null,
            configured: aiConfigured(configuration),
          }
        : null,
    };
  },
});
export const save = mutation({
  args: zodToConvexFields(aiSave.shape),
  handler: async (ctx, args) => {
    const { instance } = await requireInstanceAdmin(ctx);
    if (instance.revision !== args.expectedRevision)
      throw new ConvexError("Instance settings changed. Review the latest settings before saving.");
    if (instance.ai === undefined) throw new ConvexError("AI configuration requires explicit operator adoption.");
    const parsed = aiSave.parse(args);
    const { key, expectedRevision, ...fields } = parsed;
    const previous = instance.ai;
    const replacement = key?.trim();
    const sameKey = !replacement || (previous.key !== null && (await decrypt(previous.key)) === replacement);
    const encryptedKey = replacement && !sameKey ? await encrypt(replacement) : previous.key;
    const configuration = {
      ...fields,
      baseUrl: fields.provider === "openai_compatible" ? fields.baseUrl : "",
      codexBridgeUrl: previous.codexBridgeUrl,
      key: encryptedKey,
    };
    if (compareValues(configuration, previous) === 0) return expectedRevision;
    const revision = instance.revision + 1;
    await ctx.db.patch(instance._id, { ai: configuration, revision });
    return revision;
  },
});
// Missing-only explicit operator adoption; require ai and remove this command
// only after both hosts have complete coverage and second-pass zero.
export const adopt = internalMutation({
  args: { expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const { instance } = await requireInstanceAdmin(ctx);
    if (instance.revision !== args.expectedRevision)
      throw new ConvexError("Instance settings changed. Review the latest settings before adoption.");
    if (instance.ai !== undefined) return { changed: 0, revision: instance.revision };
    const ai = await operatorAi(process.env),
      revision = instance.revision + 1;
    await ctx.db.patch(instance._id, { ai, revision });
    return { changed: 1, revision };
  },
});
export const testConfiguration = internalQuery({
  args: { expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const { instance } = await requireInstanceAdmin(ctx);
    if (instance.revision !== args.expectedRevision)
      throw new ConvexError("Instance settings changed. Review the latest settings before testing.");
    if (instance.ai === undefined) throw new ConvexError("AI configuration requires explicit operator adoption.");
    return runtimeConfiguration(instance.ai);
  },
});
export const test = action({
  args: { expectedRevision: v.number() },
  returns: zodToConvex(aiTestResult),
  handler: async (ctx, args): Promise<z.infer<typeof aiTestResult>> => {
    const configuration = await ctx.runQuery(internal.identity.instance.ai.testConfiguration, args);
    if (!configuration) return { status: "error", code: "llm_not_configured" };
    try {
      let text = "";
      for await (const chunk of streamProvider(
        configuration,
        [
          { role: "system", content: "Return a concise health response." },
          { role: "user", content: "health-check" },
        ],
        AbortSignal.timeout(configuration.timeout * 1000)
      )) {
        text += chunk;
        if (text.length > 4096) throw new LLMError("llm_invalid_response");
      }
      if (!text.trim()) throw new LLMError("llm_invalid_response");
      return { status: "ok", provider: configuration.provider, model: configuration.model };
    } catch (failure) {
      if (failure instanceof LLMError) return { status: "error", code: failure.code };
      throw failure;
    }
  },
});
