import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { requireUser } from "./access";
import { defaultPreferences } from "./preferences_fields";
export const defaultProfile = {
  firstName: "",
  lastName: "",
  timezone: "UTC",
  revision: 0,
  preferences: defaultPreferences,
};
export async function ownProfile(ctx: QueryCtx) {
  const user = await requireUser(ctx);
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .unique();
  return { user, profile };
}
export function profileRevision(profile: Doc<"userProfiles"> | null, expected: number) {
  if (!Number.isSafeInteger(expected) || expected !== (profile?.revision ?? 0))
    throw new ConvexError("Your profile changed. Reopen it before saving.");
  return expected + 1;
}
export async function writeProfile(
  ctx: MutationCtx,
  owner: Awaited<ReturnType<typeof ownProfile>>,
  fields: Partial<
    Pick<Doc<"userProfiles">, "firstName" | "lastName" | "timezone" | "preferences" | "marketingEmailConsent">
  > & {
    revision: number;
  }
) {
  if (owner.profile) await ctx.db.patch(owner.profile._id, fields);
  else
    await ctx.db.insert("userProfiles", {
      userId: owner.user._id,
      ...defaultProfile,
      ...fields,
    });
}
