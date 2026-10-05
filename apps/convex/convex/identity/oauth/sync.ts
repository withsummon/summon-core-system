import { ConvexError, v, type Infer } from "convex/values";
import { z } from "zod/v4";
import { zodToConvex } from "convex-helpers/server/zod4";
import { components, internal } from "../../_generated/api";
import { internalAction, internalMutation, internalQuery, type QueryCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { runtimeOAuth } from "../instance/oauth";
import { accountRestricted } from "../deactivation/access";
import { configurationDigest, verifiedProviderProfile } from "./providers";
import { personalName, profileForUser, profileRevision, writeProfile } from "../profile_owner";
import { replacePersonalImage } from "../avatar_owner";
import { allocateAssetApiId } from "../../assets/schema";
import { assetSizeLimit, validateContent, validateIntent } from "../../assets/content";
import { worker } from "../../automation/generate";

const eventFields = {
  authId: v.string(),
  sessionId: v.string(),
  createdAt: v.number(),
  initial: v.boolean(),
  profile: zodToConvex(verifiedProviderProfile),
};
const event = v.object(eventFields);
const importFields = { ...eventFields, expectedRevision: v.number() };
// All arguments originate the verified provider response and issued native
// session. No public endpoint accepts a profile, user ID, or import URL.
async function currentSyncOwner(ctx: QueryCtx, args: Infer<typeof event>) {
  const current = await ctx.runQuery(components.betterAuth.adapter.currentIdentity, {
    subject: args.authId,
    sessionId: args.sessionId,
  });
  if (!current || current.user.email !== args.profile.email) return null;
  const link = await ctx.db
    .query("betterAuthLinks")
    .withIndex("by_auth_id", (q) => q.eq("authId", args.authId))
    .unique();
  if (!link || link.lastLoginAt !== args.createdAt || link.lastLoginMedium !== args.profile.provider) return null;
  if (args.initial && link.createdAppUser !== true) return null;
  const user = await ctx.db.get(link.userId);
  if (
    !user ||
    user.email !== args.profile.email ||
    user.emailVerificationTime === undefined ||
    (await accountRestricted(ctx, user._id))
  )
    return null;
  const session = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "session",
    where: [{ field: "_id", value: args.sessionId }],
  });
  if (!session || session.createdAt !== args.createdAt) return null;
  const account = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "account",
    where: [
      { field: "providerId", value: args.profile.provider },
      { field: "accountId", value: args.profile.accountId },
      { field: "userId", value: args.authId },
    ],
  });
  if (!account) return null;
  const configuration = (await runtimeOAuth(ctx)).configurations.find((row) => row.id === args.profile.provider);
  if (
    !configuration ||
    (!configuration.sync && !args.initial) ||
    (await configurationDigest(configuration)) !== args.profile.configurationDigest
  )
    return null;
  return profileForUser(ctx, user);
}
export const publishProfile = internalMutation({
  args: importFields,
  handler: async (ctx, args): Promise<void> => {
    const owner = await currentSyncOwner(ctx, args);
    if (!owner || (owner.profile?.revision ?? 0) !== args.expectedRevision) return;
    const revision = profileRevision(owner.profile, args.expectedRevision);
    const firstName = personalName(args.profile.firstName, "First name");
    const lastName = personalName(args.profile.lastName, "Last name");
    // Verified provider email is valid; the inherited display-name producer is
    // its local prefix. Provider fields are never guessed by splitting a name.
    await ctx.db.patch(owner.user._id, { name: args.profile.email.split("@")[0] });
    await writeProfile(ctx, owner, { firstName, lastName, revision });
    if (args.profile.avatarUrl === null) {
      // Refresh the actual profile after its possible insertion before pointer CAS.
      const updated = await profileForUser(ctx, owner.user);
      await replacePersonalImage(
        ctx,
        { owner: updated, revision: profileRevision(updated.profile, revision) },
        "avatar",
        null
      );
    } else
      await ctx.scheduler.runAfter(0, internal.identity.oauth.sync.importAvatar, {
        ...args,
        expectedRevision: revision,
      });
  },
});
export const importSource = internalQuery({
  args: importFields,
  handler: async (ctx, args): Promise<boolean> => {
    const owner = await currentSyncOwner(ctx, args);
    return owner !== null && (owner.profile?.revision ?? 0) === args.expectedRevision;
  },
});
const importedAvatar = z.strictObject({
  contentType: z.enum(["image/png", "image/jpeg", "image/gif", "image/webp"]),
  base64: z.string().base64().min(4).max(6990508),
});
export const importAvatar = internalAction({
  args: importFields,
  handler: async (ctx, args): Promise<Id<"assets"> | null> => {
    if (!args.profile.avatarUrl || !(await ctx.runQuery(internal.identity.oauth.sync.importSource, args))) return null;
    const file = importedAvatar.parse(
      await worker("/import-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: args.profile.avatarUrl, max_bytes: assetSizeLimit("image/png") }),
      })
    );
    const bytes = Uint8Array.from(atob(file.base64), (character) => character.charCodeAt(0));
    if (!bytes.length || bytes.length > assetSizeLimit(file.contentType))
      throw new ConvexError("Avatar exceeds the image limit.");
    const blob = new Blob([bytes], { type: file.contentType });
    await validateContent(blob, file.contentType);
    const storageId = await ctx.storage.store(blob);
    // A lost completion acknowledgement may already have published these
    // bytes. Existing unclaimed-storage retention owns cleanup, not a finally delete.
    return ctx.runMutation(internal.identity.oauth.sync.publishAvatar, {
      ...args,
      storageId,
      contentType: file.contentType,
    });
  },
});
export const publishAvatar = internalMutation({
  args: { ...importFields, storageId: v.id("_storage"), contentType: zodToConvex(importedAvatar.shape.contentType) },
  handler: async (ctx, args): Promise<Id<"assets"> | null> => {
    const owner = await currentSyncOwner(ctx, args);
    if (!owner || (owner.profile?.revision ?? 0) !== args.expectedRevision) return null;
    const metadata = await ctx.db.system.get(args.storageId);
    if (!metadata || metadata.contentType !== args.contentType)
      throw new ConvexError("Imported avatar is unavailable.");
    const name = `${args.profile.provider}-avatar.${args.contentType.slice("image/".length)}`;
    validateIntent(name, args.contentType, metadata.size, metadata.sha256);
    const existing = await ctx.db
      .query("assets")
      .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (existing) throw new ConvexError("Imported avatar storage is already claimed.");
    const revision = profileRevision(owner.profile, args.expectedRevision);
    const assetId = await ctx.db.insert("assets", {
      apiId: await allocateAssetApiId(ctx),
      workspaceId: null,
      projectId: null,
      documentId: null,
      avatarUserId: owner.user._id,
      avatarRevision: args.expectedRevision,
      avatarPublishedRevision: revision,
      purpose: "userAvatar",
      name,
      contentType: args.contentType,
      size: metadata.size,
      sha256: metadata.sha256,
      storageId: args.storageId,
      createdBy: owner.user._id,
      status: "ready",
      expiresAt: Date.now() + 7 * 86400000,
    });
    await replacePersonalImage(ctx, { owner, revision }, "avatar", assetId);
    return assetId;
  },
});
