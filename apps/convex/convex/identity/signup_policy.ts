import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { canIssueInvitation } from "../invitations/access";
import { currentAuthentication } from "./instance/authentication";
export async function canSignUp(ctx: QueryCtx, email: string) {
  if ((await currentAuthentication(ctx)).signupEnabled) return true;
  const invitations = await ctx.db
    .query("invitations")
    .withIndex("by_email", (q) => q.eq("email", email).eq("status", "pending"))
    .take(101);
  if (invitations.length > 100) throw new ConvexError("Invitation lookup exceeds the account signup budget.");
  const allowed = await Promise.all(
    invitations.map(
      async (invitation) =>
        invitation.projectId === null &&
        invitation.expiresAt > Date.now() &&
        (await canIssueInvitation(ctx, invitation.workspaceId, null, invitation.inviterId, invitation.role))
    )
  );
  return allowed.some(Boolean);
}
export async function requireSignup(ctx: QueryCtx, email: string) {
  if (!(await canSignUp(ctx, email)))
    throw new ConvexError("Sign up is disabled. Ask a workspace member for an invitation.");
}
