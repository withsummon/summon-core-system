import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
const crons = cronJobs();
crons.daily("Apply project inactivity automations", { hourUTC: 1, minuteUTC: 0 }, internal.projects.inactivity.sweep, {
  cursor: null,
});
crons.interval("Expire unfinished asset uploads", { hours: 1 }, internal.assets.cleanup.expire, {});
crons.interval("Delete unclaimed storage blobs", { hours: 1 }, internal.assets.cleanup.sweep, { cursor: null });
crons.interval("Delete expired notification read batches", { hours: 1 }, internal.notifications.cleanup.expire, {});
crons.interval(
  "Delete expired native authentication rate limits",
  { hours: 1 },
  internal.better_auth.expireRateLimits,
  {
    cursor: null,
  }
);
crons.daily("Prune external API request logs", { hourUTC: 2, minuteUTC: 30 }, internal.identity.apiAudit.prune, {});
crons.daily("Prune document history", { hourUTC: 3, minuteUTC: 0 }, internal.documents.history.prune, { cursor: null });
crons.daily("Prune task description history", { hourUTC: 3, minuteUTC: 15 }, internal.tasks.history.prune, {
  cursor: null,
});
crons.interval("Batch task notification emails", { minutes: 5 }, internal.notifications.index.dispatchEmail, {
  cutoff: null,
});
crons.daily(
  "Delete accepted task notification email logs",
  { hourUTC: 2, minuteUTC: 45 },
  internal.notifications.cleanup.expireEmail,
  {}
);
export default crons;
