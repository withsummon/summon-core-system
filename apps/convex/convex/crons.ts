import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
const crons = cronJobs();
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
crons.daily("Prune document history", { hourUTC: 3, minuteUTC: 0 }, internal.documents.history.prune, { cursor: null });
crons.daily("Prune task description history", { hourUTC: 3, minuteUTC: 15 }, internal.tasks.history.prune, {
  cursor: null,
});
export default crons;
