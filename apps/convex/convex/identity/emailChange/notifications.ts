import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { sendAccountEmail } from "../mail/sender";
export const get = internalQuery({
  args: { id: v.id("emailChangeNotices") },
  handler: (ctx, args) => ctx.db.get(args.id),
});
export const record = internalMutation({
  args: { id: v.id("emailChangeNotices"), sent: v.boolean(), expectedAttempts: v.number() },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job || job.status !== "pending" || job.attempts !== args.expectedAttempts) return;
    const attempts = job.attempts + 1;
    await ctx.db.patch(job._id, { attempts, status: args.sent ? "sent" : attempts >= 3 ? "failed" : "pending" });
    if (!args.sent && attempts < 3)
      await ctx.scheduler.runAfter(attempts * 60000, internal.identity.emailChange.notifications.deliver, {
        id: job._id,
      });
  },
});
export const deliver = internalAction({
  args: { id: v.id("emailChangeNotices") },
  handler: async (ctx, args): Promise<void> => {
    const job = await ctx.runQuery(internal.identity.emailChange.notifications.get, args);
    if (!job || job.status !== "pending") return;
    let sent = false;
    try {
      await sendAccountEmail(
        job.recipient,
        "Your Summon email address changed",
        "The email address for your Summon account was changed. All previous sessions were signed out. If you did not request this change, contact your instance administrator.",
        `email-change-${job._id}`
      );
      sent = true;
    } catch {
      // Store delivery status only; transport errors may contain sensitive provider details.
    }
    await ctx.runMutation(internal.identity.emailChange.notifications.record, {
      id: job._id,
      sent,
      expectedAttempts: job.attempts,
    });
  },
});
