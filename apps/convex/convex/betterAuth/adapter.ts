import { createApi } from "@convex-dev/better-auth";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { paginator } from "convex-helpers/server/pagination";
import { v } from "convex/values";
import { z } from "zod";
import { query } from "./_generated/server";
import { authOptions } from "../auth.config";
import schema from "./schema";

export const { create, findOne, findMany, updateOne, updateMany, deleteOne, deleteMany } = createApi(
  schema,
  () => authOptions
);

export const currentIdentity = query({
  args: { subject: v.string(), sessionId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      user: schema.doc("user"),
      sessionId: schema.id("session"),
      expiresAt: v.number(),
    })
  ),
  handler: async (ctx, { subject, sessionId }) => {
    const id = ctx.db.normalizeId("session", sessionId);
    const session = id && (await ctx.db.get(id));
    if (!session || session.userId !== subject || session.expiresAt <= Date.now()) return null;
    const userId = ctx.db.normalizeId("user", subject);
    const user = userId && (await ctx.db.get(userId));
    return user?.emailVerified ? { user, sessionId: session._id, expiresAt: session.expiresAt } : null;
  },
});

// Metadata is native JSON storage; parse it once where the row becomes public.
const metadata = z
  .string()
  .transform((value) => JSON.parse(value))
  .pipe(z.object({ description: z.string() }))
  .nullable()
  .optional();
const { key: _hashField, metadata: _metadataField, ...tokenFields } = schema.tables.apikey.validator.fields;

export const listApiKeys = query({
  args: { referenceId: v.string(), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(
    v.object({
      ...tokenFields,
      _id: v.id("apikey"),
      _creationTime: v.number(),
      name: v.string(),
      enabled: v.boolean(),
      metadata: v.optional(v.union(v.null(), v.object({ description: v.string() }))),
    })
  ),
  handler: async (ctx, { referenceId, paginationOpts }) => {
    const result = await paginator(ctx.db, schema)
      .query("apikey")
      .withIndex("referenceId", (q) => q.eq("referenceId", referenceId))
      .order("desc")
      .paginate(paginationOpts);
    return {
      ...result,
      page: result.page.map(({ key: _hash, metadata: storedMetadata, ...token }) =>
        Object.assign(token, {
          name: z.string().min(1).parse(token.name),
          enabled: z.boolean().parse(token.enabled),
          metadata: metadata.parse(storedMetadata),
        })
      ),
    };
  },
});
