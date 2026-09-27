import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "./access";
import { profileFields } from "./schema";
import { text } from "../commercial/validation";
import { validateTimezone } from "../settings/timezone";

function personalName(value: string, label: string) {
  const name = text(value, label, 255);
  if (/https?:\/\/|www\.|(?:[a-z0-9-]+\.)+[a-z]{2,6}|(?:\d{1,3}\.){3}\d{1,3}/i.test(name))
    throw new ConvexError(`${label} cannot contain a URL.`);
  return name;
}
export const get = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    return {
      id: user._id,
      email: user.email ?? null,
      displayName: user.name ?? "",
      firstName: profile?.firstName ?? "",
      lastName: profile?.lastName ?? "",
      timezone: profile?.timezone ?? "UTC",
      revision: profile?.revision ?? 0,
    };
  },
});
export const save = mutation({
  args: { ...profileFields, displayName: v.string(), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!Number.isSafeInteger(args.expectedRevision) || args.expectedRevision !== (profile?.revision ?? 0))
      throw new ConvexError("Your profile changed. Reopen it before saving.");
    const displayName = text(args.displayName, "Display name", 255, true);
    const fields = {
      firstName: personalName(args.firstName, "First name"),
      lastName: personalName(args.lastName, "Last name"),
      timezone: validateTimezone(args.timezone),
      revision: args.expectedRevision + 1,
    };
    await ctx.db.patch(user._id, { name: displayName });
    if (profile) await ctx.db.patch(profile._id, fields);
    else await ctx.db.insert("userProfiles", { userId: user._id, ...fields });
  },
});
