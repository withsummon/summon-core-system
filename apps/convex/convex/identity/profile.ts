import type { Infer } from "convex/values";
import type { MutationCtx } from "../_generated/server";
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
      marketingEmailConsent: profile?.marketingEmailConsent === true,
    };
  },
});
const saveFields = {
  ...profileFields,
  displayName: v.string(),
  expectedRevision: v.number(),
  marketingEmailConsent: v.optional(v.boolean()),
};
const saveInput = v.object(saveFields);
async function saveProfile(ctx: MutationCtx, args: Infer<typeof saveInput>, complete: boolean) {
  const owner = await ownProfile(ctx);
  const revision = profileRevision(owner.profile, args.expectedRevision);
  const displayName = text(args.displayName, "Display name", 255, true);
  const current = owner.profile ?? defaultProfile;
  const fields = {
    firstName: personalName(args.firstName, "First name"),
    lastName: personalName(args.lastName, "Last name"),
    timezone: validateTimezone(args.timezone),
    revision,
    ...(args.marketingEmailConsent === undefined ? {} : { marketingEmailConsent: args.marketingEmailConsent }),
    ...(complete
      ? {
          preferences: {
            ...current.preferences,
            onboarding: { ...current.preferences.onboarding, profileComplete: true },
          },
        }
      : {}),
  };
  await ctx.db.patch(owner.user._id, { name: displayName });
  await writeProfile(ctx, owner, fields);
  return { revision };
}
export const save = mutation({ args: saveFields, handler: (ctx, args) => saveProfile(ctx, args, false) });
export const completeProfile = mutation({ args: saveFields, handler: (ctx, args) => saveProfile(ctx, args, true) });
