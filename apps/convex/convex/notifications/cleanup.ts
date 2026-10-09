import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
export const expire = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("notificationReadBatches")
      .withIndex("by_now", (q) => q.lt("now", Date.now() - 24 * 60 * 60_000))
      .take(100);
    await Promise.all(expired.map((batch) => ctx.db.delete(batch._id)));
    if (expired.length === 100) await ctx.scheduler.runAfter(0, internal.notifications.cleanup.expire, {});
    return expired.length;
  },
});

// Match inherited sent_at retention: only parsed provider acceptance starts the seven-day window.
export const expireEmail = internalMutation({
  args: {},
  handler: async (ctx) => {
    const batch = await ctx.db
      .query("notificationEmailBatches")
      .withIndex("by_accepted", (q) => q.gt("acceptedAt", null).lte("acceptedAt", Date.now() - 7 * 24 * 60 * 60_000))
      .first();
    if (!batch) return 0;
    const logs = await ctx.db
      .query("notificationEmailLogs")
      .withIndex("by_batch", (q) => q.eq("batchId", batch._id))
      .take(10);
    await Promise.all(logs.map((log) => ctx.db.delete(log._id)));
    await Promise.all(
      [...new Set(logs.map((log) => log.deliveryId))].map(async (deliveryId) => {
        const delivery = await ctx.db.get(deliveryId);
        if (
          delivery?.completed &&
          !(await ctx.db
            .query("notificationEmailLogs")
            .withIndex("by_delivery", (q) => q.eq("deliveryId", deliveryId))
            .first())
        )
          await ctx.db.delete(deliveryId);
      })
    );
    if (logs.length < 10) await ctx.db.delete(batch._id);
    await ctx.scheduler.runAfter(0, internal.notifications.cleanup.expireEmail, {});
    return logs.length;
  },
});
