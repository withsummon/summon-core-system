import { expect, test, vi } from "vitest";
import { api, internal } from "../../../_generated/api";
import { workspaceJourney } from "../../../../test-support/fixtures";
async function fixture() {
  const f = await workspaceJourney();
  const data = await f.t.run(async (ctx) => {
    await ctx.db.patch(f.userId, { email: "owner@example.test", emailVerificationTime: Date.now() });
    const passwordId = await ctx.db.insert("authAccounts", {
      userId: f.userId,
      provider: "password",
      providerAccountId: "owner@example.test",
      secret: "verified-hash",
    });
    const targetId = await ctx.db.insert("authAccounts", {
      userId: f.userId,
      provider: "github",
      providerAccountId: "github123",
      emailVerified: "owner@example.test",
    });
    const sessionId = await ctx.db.insert("authSessions", { userId: f.userId, expirationTime: Date.now() + 600000 });
    return { passwordId, targetId, sessionId };
  });
  return { ...f, ...data, actor: f.t.withIdentity({ subject: `${f.userId}|${data.sessionId}` }) };
}
test("disconnect removes owned provider codes and every own session atomically, retaining password and other users", async () => {
  const f = await fixture();
  const other = await f.t.run(async (ctx) => {
    await ctx.db.insert("authVerificationCodes", {
      accountId: f.targetId,
      provider: "github",
      code: "fixture-code",
      expirationTime: Date.now() + 60000,
    });
    await ctx.db.insert("authRefreshTokens", { sessionId: f.sessionId, expirationTime: Date.now() + 60000 });
    const userId = await ctx.db.insert("users", {});
    return ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 60000 });
  });
  await f.actor.mutation(internal.identity.accounts.unlink.commit, {
    targetId: f.targetId,
    sessionId: f.sessionId,
    accountId: f.passwordId,
    expectedSecret: "verified-hash",
  });
  await f.t.run(async (ctx) => {
    expect(await ctx.db.get(f.targetId)).toBeNull();
    expect(await ctx.db.get(f.passwordId)).not.toBeNull();
    expect(await ctx.db.get(other)).not.toBeNull();
    expect(await ctx.db.query("authVerificationCodes").collect()).toEqual([]);
    expect(await ctx.db.query("authRefreshTokens").collect()).toEqual([]);
  });
  expect(await f.actor.query(api.identity.session.status, {})).toEqual({ valid: false });
});
test("disabled or mismatched verified email OAuth cannot justify removing password", async () => {
  const f = await fixture();
  const args = {
    targetId: f.passwordId,
    sessionId: f.sessionId,
    accountId: f.passwordId,
    expectedSecret: "verified-hash",
  };
  await expect(f.actor.mutation(internal.identity.accounts.unlink.commit, args)).rejects.toThrow("Keep another");
  vi.stubEnv("GITHUB_CLIENT_ID", "fixture");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "fixture");
  try {
    await f.t.run((ctx) => ctx.db.patch(f.targetId, { emailVerified: "somebody-else@example.test" }));
    await expect(f.actor.mutation(internal.identity.accounts.unlink.commit, args)).rejects.toThrow("Keep another");
    await f.t.run((ctx) => ctx.db.patch(f.targetId, { emailVerified: "owner@example.test" }));
    await f.actor.mutation(internal.identity.accounts.unlink.commit, args);
    expect(await f.t.run((ctx) => ctx.db.get(f.passwordId))).toBeNull();
  } finally {
    vi.unstubAllEnvs();
  }
});
test("captured proof race and foreign target fail without deleting accounts", async () => {
  const f = await fixture();
  await expect(
    f.actor.mutation(internal.identity.accounts.unlink.commit, {
      targetId: f.targetId,
      sessionId: f.sessionId,
      accountId: f.passwordId,
      expectedSecret: "old-hash",
    })
  ).rejects.toThrow("Password changed");
  const foreign = await f.t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {});
    return ctx.db.insert("authAccounts", { userId, provider: "github", providerAccountId: "other" });
  });
  await expect(
    f.actor.mutation(internal.identity.accounts.unlink.commit, {
      targetId: foreign,
      sessionId: f.sessionId,
      accountId: f.passwordId,
      expectedSecret: "verified-hash",
    })
  ).rejects.toThrow("not found");
  expect(await f.t.run((ctx) => ctx.db.get(f.targetId))).not.toBeNull();
});
test("cleanup overflow rolls back account and codes", async () => {
  const f = await fixture();
  await f.t.run((ctx) =>
    Promise.all(
      Array.from({ length: 101 }, (_, i) =>
        ctx.db.insert("authVerificationCodes", {
          accountId: f.targetId,
          provider: "github",
          code: `fixture-${i}`,
          expirationTime: Date.now() + 60000,
        })
      )
    )
  );
  await expect(
    f.actor.mutation(internal.identity.accounts.unlink.commit, {
      targetId: f.targetId,
      sessionId: f.sessionId,
      accountId: f.passwordId,
      expectedSecret: "verified-hash",
    })
  ).rejects.toThrow("budget");
  expect(await f.actor.query(api.identity.session.status, {})).toMatchObject({ valid: true });
  expect(await f.t.run((ctx) => ctx.db.get(f.targetId))).not.toBeNull();
});

test("canonical disconnect options leave the sole usable password protected", async () => {
  const f = await fixture();
  const result = await f.actor.query(api.identity.accounts.unlink.options, {});
  expect(result.requiresPassword).toBe(true);
  expect(result.accounts.find((row) => row.id === f.passwordId)?.canDisconnect).toBe(false);
  expect(result.accounts.find((row) => row.id === f.targetId)?.canDisconnect).toBe(true);
  expect(new Set(Object.keys(result.accounts[0]))).toEqual(new Set(["id", "canDisconnect"]));
});

test("disabled password cannot justify disconnecting the last usable account", async () => {
  const f = await fixture();
  vi.stubEnv("ENABLE_EMAIL_PASSWORD", "0");
  try {
    await expect(
      f.actor.mutation(internal.identity.accounts.unlink.commit, {
        targetId: f.targetId,
        sessionId: f.sessionId,
        accountId: f.passwordId,
        expectedSecret: "verified-hash",
      })
    ).rejects.toThrow("Keep another");
    expect(await f.t.run(async (ctx) => Boolean(await ctx.db.get(f.targetId)))).toBe(true);
    expect((await f.actor.query(api.identity.session.status, {})).valid).toBe(true);
  } finally {
    vi.unstubAllEnvs();
  }
});
