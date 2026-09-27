import { signedIn } from "../../../test-support/session";
import { expect, test, vi } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { INVITATION_LIFETIME_MS } from "../access";
async function fixture() {
  const f = await workspaceJourney();
  const userId = await f.t.run((ctx) =>
    ctx.db.insert("users", { email: "invitee@example.test", emailVerificationTime: 1 })
  );
  const invitee = await signedIn(f.t, userId);
  const issue = (projectId: typeof f.projectId | null = null) =>
    f.owner.action(api.invitations.tokens.create, {
      workspaceId: f.workspaceId,
      projectId,
      email: "Invitee@Example.test",
      role: "member",
    });
  return { ...f, recipientId: userId, invitee, issue };
}
test("invitation stores only hash, binds verified current email, consumes once and grants stable identity", async () => {
  const f = await fixture();
  const invite = await f.issue();
  const stored = await f.t.run((ctx) => ctx.db.get(invite.invitationId));
  expect(stored?.tokenHash).not.toBe(invite.token);
  expect(JSON.stringify(stored)).not.toContain(invite.token);
  const listed = await f.owner.query(api.invitations.index.list, {
    workspaceId: f.workspaceId,
    projectId: null,
    paginationOpts: { cursor: null, numItems: 20 },
  });
  expect(listed.page[0]).not.toHaveProperty("tokenHash");
  await expect(f.owner.action(api.invitations.tokens.respond, { ...invite, accepted: true })).rejects.toThrow("Verify");
  expect(await f.invitee.action(api.invitations.tokens.respond, { ...invite, accepted: true })).toMatchObject({
    accepted: true,
    workspaceId: f.workspaceId,
  });
  await expect(f.invitee.action(api.invitations.tokens.respond, { ...invite, accepted: true })).rejects.toThrow(
    "already"
  );
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace_user", (q) => q.eq("workspaceId", f.workspaceId).eq("userId", f.recipientId))
        .unique()
    )
  ).toMatchObject({ role: "member", active: true });
});
test("rotation invalidates old token, expiry and current issuer revocation prevent grant", async () => {
  const f = await fixture();
  const invite = await f.issue();
  const rotated = await f.owner.action(api.invitations.tokens.rotate, {
    invitationId: invite.invitationId,
    expectedRevision: 0,
  });
  await expect(f.invitee.action(api.invitations.tokens.respond, { ...invite, accepted: true })).rejects.toThrow(
    "unavailable"
  );
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + INVITATION_LIFETIME_MS + 1);
  await expect(
    f.invitee.action(api.invitations.tokens.respond, {
      invitationId: invite.invitationId,
      token: rotated.token,
      accepted: true,
    })
  ).rejects.toThrow("expired");
  vi.restoreAllMocks();
  await f.t.run(async (ctx) => {
    const member = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", f.workspaceId).eq("userId", f.userId))
      .unique();
    await ctx.db.patch(member!._id, { active: false });
  });
  await expect(
    f.invitee.action(api.invitations.tokens.respond, {
      invitationId: invite.invitationId,
      token: rotated.token,
      accepted: true,
    })
  ).rejects.toThrow("authority");
});
test("workspace members can invite up to own role, guests cannot issue, project acceptance creates capped workspace access", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const member = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", f.workspaceId).eq("userId", f.userId))
      .unique();
    await ctx.db.patch(member!._id, { role: "member" });
  });
  await expect(
    f.owner.action(api.invitations.tokens.create, {
      workspaceId: f.workspaceId,
      projectId: null,
      email: "a@example.test",
      role: "admin",
    })
  ).rejects.toThrow("authority");
  const invite = await f.owner.action(api.invitations.tokens.create, {
    workspaceId: f.workspaceId,
    projectId: f.projectId,
    email: "invitee@example.test",
    role: "admin",
  });
  await f.invitee.action(api.invitations.tokens.respond, { ...invite, accepted: true });
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace_user", (q) => q.eq("workspaceId", f.workspaceId).eq("userId", f.recipientId))
        .unique()
    )
  ).toMatchObject({ role: "member" });
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("projectMembers")
        .withIndex("by_project_user", (q) => q.eq("projectId", f.projectId).eq("userId", f.recipientId))
        .unique()
    )
  ).toMatchObject({ role: "admin" });
});
test("project invite cannot upgrade existing workspace guest and active admin cannot be downgraded", async () => {
  const f = await fixture();
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: f.recipientId,
    role: "guest",
  });
  const invite = await f.issue(f.projectId);
  await expect(f.invitee.action(api.invitations.tokens.respond, { ...invite, accepted: true })).rejects.toThrow(
    "guests"
  );
  expect((await f.t.run((ctx) => ctx.db.get(invite.invitationId)))?.status).toBe("pending");
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: f.recipientId,
    role: "admin",
  });
  const workspace = await f.issue();
  await f.invitee.action(api.invitations.tokens.respond, { ...workspace, accepted: true });
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace_user", (q) => q.eq("workspaceId", f.workspaceId).eq("userId", f.recipientId))
        .unique()
    )
  ).toMatchObject({ role: "admin" });
});
test("wrong or changed recipient email, unverified identity and revoked invitations never consume", async () => {
  const f = await fixture();
  const invite = await f.issue();
  await f.t.run((ctx) => ctx.db.patch(f.recipientId, { email: "changed@example.test" }));
  await expect(f.invitee.action(api.invitations.tokens.respond, { ...invite, accepted: true })).rejects.toThrow(
    "unavailable"
  );
  await f.t.run((ctx) =>
    ctx.db.patch(f.recipientId, { email: "invitee@example.test", emailVerificationTime: undefined })
  );
  await expect(f.invitee.action(api.invitations.tokens.respond, { ...invite, accepted: true })).rejects.toThrow(
    "Verify"
  );
  await f.t.run((ctx) => ctx.db.patch(f.recipientId, { emailVerificationTime: 1 }));
  await f.owner.mutation(api.invitations.index.revoke, { invitationId: invite.invitationId, expectedRevision: 0 });
  await expect(f.invitee.action(api.invitations.tokens.respond, { ...invite, accepted: true })).rejects.toThrow(
    "already"
  );
  expect(
    (await f.invitee.query(api.invitations.index.incoming, { paginationOpts: { cursor: null, numItems: 20 } })).page
  ).toEqual([]);
});
test("concurrent response has one winner and decline grants no membership", async () => {
  const f = await fixture();
  const invite = await f.issue();
  const responses = await Promise.allSettled(
    [true, true].map((accepted) => f.invitee.action(api.invitations.tokens.respond, { ...invite, accepted }))
  );
  expect(responses.filter((row) => row.status === "fulfilled")).toHaveLength(1);
  const otherId = await f.t.run((ctx) =>
    ctx.db.insert("users", { email: "decline@example.test", emailVerificationTime: 1 })
  );
  const other = await signedIn(f.t, otherId);
  const decline = await f.owner.action(api.invitations.tokens.create, {
    workspaceId: f.workspaceId,
    projectId: null,
    email: "decline@example.test",
    role: "guest",
  });
  await other.action(api.invitations.tokens.respond, { ...decline, accepted: false });
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace_user", (q) => q.eq("workspaceId", f.workspaceId).eq("userId", otherId))
        .unique()
    )
  ).toBeNull();
});
test("guests cannot issue and forged project scope never creates an invitation", async () => {
  const f = await fixture();
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: f.recipientId,
    role: "guest",
  });
  await expect(
    f.invitee.action(api.invitations.tokens.create, {
      workspaceId: f.workspaceId,
      projectId: null,
      email: "other@example.test",
      role: "guest",
    })
  ).rejects.toThrow("authority");
  const ws = await f.owner.mutation(api.workspaces.index.create, { name: "Foreign", slug: "foreign" });
  await expect(
    f.owner.action(api.invitations.tokens.create, {
      workspaceId: ws,
      projectId: f.projectId,
      email: "other@example.test",
      role: "guest",
    })
  ).rejects.toThrow("project administrators");
  expect(await f.t.run((ctx) => ctx.db.query("invitations").collect())).toEqual([]);
});
