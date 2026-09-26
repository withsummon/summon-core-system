import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
const crons = cronJobs();
crons.interval("Expire unfinished asset uploads", { hours: 1 }, internal.assets.cleanup.expire, {});
crons.interval("Delete unclaimed storage blobs", { hours: 1 }, internal.assets.cleanup.sweep, { cursor: null });
export default crons;
