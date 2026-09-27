import { expect, test } from "vitest";
import { api } from "../../../_generated/api";
import { workspaceJourney } from "../../../../test-support/fixtures";
import { signedIn } from "../../../../test-support/session";

test.each(["issuer", "recipient"] as const)(
  "restricted %s cannot consume a pending invitation through the public action",
  async (restricted) => {
    const f = await workspaceJourney();
    const userId = await f.t.run((ctx) =>
      ctx.db.insert("users", { email: "invitee@example.test", emailVerificationTime: 1 })
    );
    const recipient = await signedIn(f.t, userId);
    const invitation = await f.owner.action(api.invitations.tokens.create, {
      workspaceId: f.workspaceId,
      projectId: f.projectId,
      email: "invitee@example.test",
      role: "member",
    });
    await f.t.run((ctx) =>
      ctx.db.insert("accountRestrictions", {
        userId: restricted === "issuer" ? f.userId : userId,
        deactivatedAt: Date.now(),
      })
    );
    await expect(recipient.action(api.invitations.tokens.respond, { ...invitation, accepted: true })).rejects.toThrow(
      restricted === "issuer" ? "deactivated" : "expired"
    );
    await f.t.run(async (ctx) => {
      expect((await ctx.db.get(invitation.invitationId))?.status).toBe("pending");
      expect(
        await ctx.db
          .query("workspaceMembers")
          .withIndex("by_workspace_user", (q) => q.eq("workspaceId", f.workspaceId).eq("userId", userId))
          .unique()
      ).toBeNull();
      expect(
        await ctx.db
          .query("projectMembers")
          .withIndex("by_project_user", (q) => q.eq("projectId", f.projectId).eq("userId", userId))
          .unique()
      ).toBeNull();
    });
    if (restricted === "recipient")
      await expect(
        recipient.query(api.invitations.index.incoming, { paginationOpts: { cursor: null, numItems: 10 } })
      ).rejects.toThrow("expired");
    else
      expect(
        (await recipient.query(api.invitations.index.incoming, { paginationOpts: { cursor: null, numItems: 10 } })).page
      ).toHaveLength(1);
  }
);
