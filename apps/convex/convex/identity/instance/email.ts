import { ConvexError, v, compareValues } from "convex/values";
import { z } from "zod/v4";
import { zodToConvex, zodToConvexFields } from "convex-helpers/server/zod4";
import { action, internalMutation, internalQuery, mutation, query, type QueryCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { requireInstanceAdmin } from "./access";
import { encrypt, decrypt } from "../../mcp/crypto";
import { currentOrigin, mailConfiguration, mailSender, resendApiKey } from "../mail/config";
import { sendAccountEmail } from "../mail/sender";

const revision = z.int().nonnegative();
const saveInput = z.object({ expectedRevision: revision, apiKey: z.union([resendApiKey.or(z.literal("")), z.null()]) });
const testInput = z.object({
  expectedRevision: revision,
  recipient: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  requestId: z.uuid(),
});
async function instanceMail(ctx: QueryCtx) {
  return ctx.db
    .query("instanceAuthority")
    .withIndex("by_key", (q) => q.eq("key", "instance"))
    .unique();
}
export function mailForInstance(instance: Doc<"instanceAuthority"> | null) {
  if (!instance) return { adoptionRequired: false, configured: mailConfiguration(process.env) !== null };
  return {
    adoptionRequired: instance.resendKey === undefined,
    configured: instance.resendKey != null && currentOrigin(process.env) !== null,
  };
}
export async function currentMailReadiness(ctx: QueryCtx) {
  return mailForInstance(await instanceMail(ctx));
}
async function configurationForInstance(instance: Doc<"instanceAuthority"> | null) {
  if (!instance) return mailConfiguration(process.env);
  const siteUrl = currentOrigin(process.env);
  if (!instance.resendKey || !siteUrl) return null;
  return { apiKey: resendApiKey.parse(await decrypt(instance.resendKey)), from: mailSender, siteUrl };
}
export async function operatorResendKey(env: Record<string, string | undefined>) {
  const configuration = mailConfiguration(env);
  return configuration ? encrypt(configuration.apiKey) : null;
}
export async function runtimeMail(ctx: QueryCtx) {
  return configurationForInstance(await instanceMail(ctx));
}
export const runtime = internalQuery({ args: {}, handler: runtimeMail });
export const readiness = internalQuery({ args: {}, handler: currentMailReadiness });
export const get = query({
  args: {},
  handler: async (ctx) => {
    const { instance } = await requireInstanceAdmin(ctx);
    return {
      ...mailForInstance(instance),
      credentialPresent: instance.resendKey != null,
      revision: instance.revision,
      from: mailSender,
    };
  },
});
export const save = mutation({
  args: zodToConvexFields(saveInput.shape),
  handler: async (ctx, input) => {
    const { instance } = await requireInstanceAdmin(ctx);
    const args = saveInput.parse(input);
    if (instance.revision !== args.expectedRevision)
      throw new ConvexError("Instance settings changed. Review the latest settings before saving.");
    if (instance.resendKey === undefined)
      throw new ConvexError("Email configuration requires explicit operator adoption.");
    if (args.apiKey === "" && instance.resendKey === null) throw new ConvexError("Enter a Resend API key.");
    if (args.apiKey && instance.resendKey && args.apiKey === (await decrypt(instance.resendKey)))
      return instance.revision;
    const resendKey =
      args.apiKey === null ? null : args.apiKey === "" ? instance.resendKey : await encrypt(args.apiKey);
    if (compareValues(resendKey, instance.resendKey) === 0) return instance.revision;
    const nextRevision = instance.revision + 1;
    await ctx.db.patch(instance._id, { resendKey, revision: nextRevision });
    return nextRevision;
  },
});
// Missing-only operator adoption; require this field and delete the RPC only
// after both hosts prove complete coverage and a second pass changes zero.
export const adopt = internalMutation({
  args: { expectedRevision: zodToConvex(revision) },
  handler: async (ctx, args) => {
    const { instance } = await requireInstanceAdmin(ctx);
    if (instance.revision !== revision.parse(args.expectedRevision))
      throw new ConvexError("Instance settings changed. Review the latest settings before adoption.");
    if (instance.resendKey !== undefined) return { changed: 0, revision: instance.revision };
    const resendKey = await operatorResendKey(process.env);
    const nextRevision = instance.revision + 1;
    await ctx.db.patch(instance._id, { resendKey, revision: nextRevision });
    return { changed: 1, revision: nextRevision };
  },
});
export const testConfiguration = internalQuery({
  args: { expectedRevision: zodToConvex(revision) },
  handler: async (ctx, args) => {
    const { instance } = await requireInstanceAdmin(ctx);
    if (instance.revision !== revision.parse(args.expectedRevision))
      throw new ConvexError("Instance settings changed. Review the latest settings before testing.");
    const configuration = await configurationForInstance(instance);
    if (!configuration) throw new ConvexError("Email delivery is not configured.");
    return configuration;
  },
});
export const test = action({
  args: zodToConvexFields(testInput.shape),
  returns: v.string(),
  handler: async (ctx, input): Promise<string> => {
    const args = testInput.parse(input);
    const configuration = await ctx.runQuery(internal.identity.instance.email.testConfiguration, {
      expectedRevision: args.expectedRevision,
    });
    try {
      return await sendAccountEmail(
        configuration,
        args.recipient,
        "Summon test email",
        "Your Summon instance accepted this request to test its Resend email configuration.",
        args.requestId
      );
    } catch {
      throw new ConvexError(
        "Resend acceptance could not be confirmed. Retry the same test to preserve its request identity."
      );
    }
  },
});
