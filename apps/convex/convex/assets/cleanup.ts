import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

export const expire = internalMutation({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("assets")
      .withIndex("by_status_expiry", (q) => q.eq("status", "pending").lte("expiresAt", Date.now()))
      .take(100);
    await Promise.all(
      pending.map(async (asset) => {
        if (asset.storageId && (await ctx.db.system.get(asset.storageId))) await ctx.storage.delete(asset.storageId);
        await ctx.db.patch(asset._id, { status: "expired", storageId: null });
      })
    );
    if (pending.length === 100) await ctx.scheduler.runAfter(0, internal.assets.cleanup.expire, {});
  },
});
// Assets is currently the sole _storage reference owner. Future storage domains
// must register here before storing blobs; otherwise unclaimed blobs expire.
export const sweep = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const result = await ctx.db.system.query("_storage").paginate({ numItems: 100, cursor });
    await Promise.all(
      result.page
        .filter((blob) => blob._creationTime < Date.now() - 24 * 60 * 60 * 1000)
        .map(async (blob) => {
          const asset = await ctx.db
            .query("assets")
            .withIndex("by_storage", (q) => q.eq("storageId", blob._id))
            .unique();
          if (asset?.meetingId && asset.status === "ready") {
            const meeting = await ctx.db.get(asset.meetingId);
            if (
              !meeting ||
              meeting.deleted ||
              (meeting.recordingAssetId !== asset._id && asset.expiresAt <= Date.now())
            ) {
              await ctx.storage.delete(blob._id);
              await ctx.db.patch(asset._id, { status: "expired", storageId: null });
            }
            return;
          }
          if (!asset || (asset.status !== "ready" && !(asset.status === "deleted" && asset.expiresAt > Date.now())))
            await ctx.storage.delete(blob._id);
        })
    );
    if (!result.isDone)
      await ctx.scheduler.runAfter(0, internal.assets.cleanup.sweep, { cursor: result.continueCursor });
  },
});
