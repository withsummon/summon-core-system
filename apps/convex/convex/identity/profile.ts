import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { defaultProfile, ownProfile, profileRevision, writeProfile } from "./profile_owner";
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
    const { user, profile } = await ownProfile(ctx);
    const stored = profile ?? defaultProfile;
    return {
      id: user._id,
      email: user.email ?? null,
      displayName: user.name ?? "",
      firstName: stored.firstName,
      lastName: stored.lastName,
      timezone: stored.timezone,
      revision: stored.revision,
      preferences: stored.preferences,
    };
  },
});
export const save = mutation({
  args: { ...profileFields, displayName: v.string(), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const owner = await ownProfile(ctx);
    const { user, profile } = owner;
    const revision = profileRevision(profile, args.expectedRevision);
    const displayName = text(args.displayName, "Display name", 255, true);
    const fields = {
      firstName: personalName(args.firstName, "First name"),
      lastName: personalName(args.lastName, "Last name"),
      timezone: validateTimezone(args.timezone),
      revision,
    };
    await ctx.db.patch(user._id, { name: displayName });
    await writeProfile(ctx, owner, fields);
  },
});
