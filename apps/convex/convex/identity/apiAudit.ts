import { z } from "zod/v4";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { apiRequestFields, apiRequestMetadata } from "./schema";

// Retention is current operator configuration, including the inherited zero-day
// window. Malformed/negative values retain the inherited fourteen-day default.
const retentionDays = z
  .string()
  .trim()
  .regex(/^[+-]?\d+$/)
  .transform(Number)
  .pipe(z.int().nonnegative())
  .catch(14);

export const record = internalMutation({
  args: apiRequestFields,
  handler: (ctx, args) => ctx.db.insert("apiRequestLogs", apiRequestMetadata.parse(args)),
});
export const prune = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - retentionDays.parse(process.env.API_ACTIVITY_LOG_RETENTION_DAYS) * 24 * 60 * 60_000;
    const expired = await ctx.db
      .query("apiRequestLogs")
      .withIndex("by_creation_time", (q) => q.lte("_creationTime", cutoff))
      .take(100);
    await Promise.all(expired.map((row) => ctx.db.delete(row._id)));
    if (expired.length === 100) await ctx.scheduler.runAfter(0, internal.identity.apiAudit.prune, {});
    return expired.length;
  },
});
