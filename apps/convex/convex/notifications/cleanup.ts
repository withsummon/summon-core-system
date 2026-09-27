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
