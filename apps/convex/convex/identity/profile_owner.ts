import { ConvexError, v, type Infer } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { role } from "../schema";
import { requireUser } from "./access";
import { defaultPreferences } from "./preferences_fields";
export const defaultProfile = {
  firstName: "",
  lastName: "",
  timezone: "UTC",
  revision: 0,
  preferences: defaultPreferences,
};
export const MAX_MEMBER_DIRECTORY_MEMBERS = 1000;
export const memberDirectoryOrder = v.object({
  field: v.union(
    v.literal("fullName"),
    v.literal("displayName"),
    v.literal("email"),
    v.literal("role"),
    v.literal("joinedAt")
  ),
  direction: v.union(v.literal("asc"), v.literal("desc")),
});
export async function profileIdentity(ctx: QueryCtx, userId: Id<"users">) {
  const [user, profile] = await Promise.all([
    ctx.db.get(userId),
    ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique(),
  ]);
  if (!user) return null;
  const names = profile ?? defaultProfile;
  return {
    userId,
    displayName: user.name ?? null,
    firstName: names.firstName,
    lastName: names.lastName,
    fullName: `${names.firstName} ${names.lastName}`.trim(),
    email: user.email ?? null,
  };
}
export function sortMemberDirectory<
  T extends NonNullable<Awaited<ReturnType<typeof profileIdentity>>> &
    Pick<Doc<"workspaceMembers">, "role" | "active"> & { joinedAt: Doc<"workspaceMembers">["_creationTime"] },
>(rows: T[], orderBy: Infer<typeof memberDirectoryOrder> | undefined) {
  const field = orderBy?.field ?? "joinedAt";
  const direction = orderBy?.direction === "asc" ? 1 : -1;
  // The canonical role schema lists administrator through guest; this is display order only.
  const roleOrder = role.members.map((entry) => entry.value);
  // oxlint-disable-next-line unicorn/no-array-sort -- Sort a private directory array in place; generated consumers use the web's ES2020 lib.
  return rows.sort((a, b) => {
    const comparison =
      field === "joinedAt"
        ? a.joinedAt - b.joinedAt
        : field === "role"
          ? roleOrder.indexOf(b.role) - roleOrder.indexOf(a.role)
          : (a[field] ?? "").toLocaleLowerCase().localeCompare((b[field] ?? "").toLocaleLowerCase());
    return Number(b.active) - Number(a.active) || comparison * direction || a.userId.localeCompare(b.userId);
  });
}
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
