import { ConvexError, v } from "convex/values";
import { httpAction, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { externalApiHeaders, verifyRequest } from "./apiTokens";
import { requireAccountUser } from "./session";
import { profileIdentity } from "./profile_owner";
import { personalImageDescriptor, userAppearance } from "./avatar_owner";
import { userApiId } from "./schema";

// This is the inherited UserLite public representation, not a session profile.
export const user = internalQuery({
  args: { userId: v.id("users"), assetOrigin: v.string() },
  handler: async (ctx, { userId, assetOrigin }) => {
    let account;
    try {
      account = await requireAccountUser(ctx, userId);
    } catch (error) {
      if (error instanceof ConvexError)
        return { status: 403 as const, body: { detail: "Your account is unavailable." } };
      throw error;
    }
    if (account.apiId === undefined)
      return { status: 503 as const, body: { detail: "User API identifier migration is incomplete." } };
    const id = userApiId.parse(account.apiId);
    const profile = await profileIdentity(ctx, account._id);
    if (!profile) throw new ConvexError("Your account is unavailable.");
    const avatar = await personalImageDescriptor(ctx, await userAppearance(ctx, account._id), "avatar");
    return {
      status: 200 as const,
      body: {
        id,
        first_name: profile.firstName,
        last_name: profile.lastName,
        email: profile.email,
        avatar: account.image ?? "",
        avatar_url: avatar ? new URL(avatar.downloadPath, assetOrigin).toString() : account.image || null,
        display_name: profile.displayName ?? "",
      },
    };
  },
});
export const options = httpAction(async () => new Response(null, { status: 204, headers: externalApiHeaders }));
export const currentUser = httpAction(async (ctx, request) => {
  const credential = await verifyRequest(ctx, request);
  if (credential.status !== 200)
    return Response.json(
      { detail: credential.detail },
      { status: credential.status, headers: { ...externalApiHeaders, ...credential.headers } }
    );
  const headers = { ...externalApiHeaders, ...credential.headers };
  const result = await ctx.runQuery(internal.identity.external.user, {
    userId: credential.userId,
    assetOrigin: new URL(request.url).origin,
  });
  return Response.json(result.body, { status: result.status, headers });
});
