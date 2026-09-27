import { expect, test, vi } from "vitest";
import { api, internal } from "../../../_generated/api";
import { workspaceJourney } from "../../../../test-support/fixtures";
import { requireUnrestrictedAccount } from "../access";
import { issuerAccess } from "../../../invitations/access";
async function fixture() {
  const f = await workspaceJourney();
  await f.t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: "instance@example.test", emailVerificationTime: Date.now() });
    const instanceId = await ctx.db.insert("instanceAuthority", { key: "instance", initializedAt: Date.now() });
    await ctx.db.insert("instanceAdmins", { instanceId, userId, role: "admin", revision: 1 });
  });
  const sessionId = await f.t.run((ctx) =>
    ctx.db.insert("authSessions", { userId: f.userId, expirationTime: Date.now() + 600000 })
  );
  const actor = f.t.withIdentity({ subject: `${f.userId}|${sessionId}` });
  return { ...f, sessionId, actor };
}
async function successor(f: Awaited<ReturnType<typeof fixture>>) {
  const userId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Successor" }));
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role: "admin" });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId, role: "admin" });
  return userId;
}
test("last administrator rejection is atomic, including archived project recovery", async () => {
  const f = await fixture();
  await expect(
    f.actor.mutation(internal.identity.deactivation.index.commit, { sessionId: f.sessionId })
  ).rejects.toThrow("workspace administrator");
  await successor(f);
  await f.t.run(async (ctx) => {
    const members = await ctx.db.query("projectMembers").collect();
    for (const m of members) if (m.userId !== f.userId) await ctx.db.patch(m._id, { active: false });
    await ctx.db.patch(f.projectId, { archived: true });
  });
  await expect(
    f.actor.mutation(internal.identity.deactivation.index.commit, { sessionId: f.sessionId })
  ).rejects.toThrow("project administrator");
  expect(await f.actor.query(api.identity.session.status, {})).toMatchObject({ valid: true });
});
test("deactivation retains identity/content, removes sessions and refresh chains, rejects reads and grants", async () => {
  const f = await fixture();
  await successor(f);
  await f.t.run((ctx) =>
    ctx.db.insert("authRefreshTokens", { sessionId: f.sessionId, expirationTime: Date.now() + 60000 })
  );
  await f.actor.mutation(internal.identity.deactivation.index.commit, { sessionId: f.sessionId });
  expect(await f.actor.query(api.identity.session.status, {})).toEqual({ valid: false });
  await f.t.run(async (ctx) => {
    expect(await ctx.db.get(f.userId)).not.toBeNull();
    expect(await ctx.db.get(f.projectId)).not.toBeNull();
    expect(await ctx.db.query("authRefreshTokens").collect()).toEqual([]);
    expect((await ctx.db.query("workspaceMembers").collect()).find((m) => m.userId === f.userId)?.active).toBe(false);
    await expect(requireUnrestrictedAccount(ctx, f.userId)).rejects.toThrow("deactivated");
  });
});
test("captured password hash cannot authorize after an intervening credential change", async () => {
  const f = await fixture();
  await successor(f);
  const accountId = await f.t.run((ctx) =>
    ctx.db.insert("authAccounts", {
      userId: f.userId,
      provider: "password",
      providerAccountId: "owner@example.test",
      secret: "new-hash",
    })
  );
  await expect(
    f.actor.mutation(internal.identity.deactivation.index.commit, {
      sessionId: f.sessionId,
      accountId,
      expectedSecret: "old-verified-hash",
    })
  ).rejects.toThrow("Password changed");
  expect(await f.actor.query(api.identity.session.status, {})).toMatchObject({ valid: true });
});
test("membership budget rejects before restriction or cleanup", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    await Promise.all(
      Array.from({ length: 101 }, () =>
        ctx.db.insert("authSessions", { userId: f.userId, expirationTime: Date.now() + 60000 })
      )
    );
  });
  await expect(
    f.actor.mutation(internal.identity.deactivation.index.commit, { sessionId: f.sessionId })
  ).rejects.toThrow("budget");
  expect(await f.actor.query(api.identity.session.status, {})).toMatchObject({ valid: true });
});

test("email-only proof expires based on session creation and leaves account active", async () => {
  vi.useFakeTimers();
  try {
    const f = await fixture();
    await successor(f);
    vi.setSystemTime(Date.now() + 5 * 60 * 1000 + 1);
    await expect(
      f.actor.mutation(internal.identity.deactivation.index.commit, { sessionId: f.sessionId })
    ).rejects.toThrow("Sign in again before");
    expect(await f.actor.query(api.identity.session.status, {})).toMatchObject({ valid: true });
  } finally {
    vi.useRealTimers();
  }
});
test("restricted target cannot regain workspace membership or invitation issuer authority", async () => {
  const f = await fixture();
  const userId = await successor(f);
  const sessionId = await f.t.run((ctx) =>
    ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 60000 })
  );
  const admin = f.t.withIdentity({ subject: `${userId}|${sessionId}` });
  await f.actor.mutation(internal.identity.deactivation.index.commit, { sessionId: f.sessionId });
  await expect(
    admin.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId: f.userId, role: "admin" })
  ).rejects.toThrow("deactivated");
  await expect(
    admin.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId: f.userId, role: "admin" })
  ).rejects.toThrow("deactivated");
});

test("restricted inviter is denied even if a stale active membership remains", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    await ctx.db.insert("accountRestrictions", { userId: f.userId, deactivatedAt: Date.now() });
    await expect(issuerAccess(ctx, f.workspaceId, null, f.userId, "member")).rejects.toThrow("deactivated");
  });
});
