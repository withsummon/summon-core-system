import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import { createAccount, retrieveAccount, modifyAccountCredentials } from "@convex-dev/auth/server";
import schema from "../../../schema";
import { api } from "../../../_generated/api";
const modules = import.meta.glob("/convex/**/*.{ts,js}");
const email = "password-fixture@example.test";
beforeEach(() => {
  vi.stubEnv("AUTH_LOG_LEVEL", "ERROR");
  vi.stubEnv("AUTH_LOG_SECRETS", "false");
});
afterEach(() => vi.unstubAllEnvs());
async function fixture(password = true) {
  const t = convexTest(schema, modules);
  const userId = password
    ? (
        await t.action((ctx) =>
          createAccount(ctx, {
            provider: "password",
            account: { id: email, secret: "old-password" },
            profile: { email, emailVerificationTime: 1 },
          })
        )
      ).user._id
    : await t.run((ctx) => ctx.db.insert("users", { email, emailVerificationTime: 1 }));
  const sessionId = await t.run((ctx) =>
    ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 600000 })
  );
  const owner = t.withIdentity({ subject: `${userId}|${sessionId}` });
  return { t, userId, sessionId, owner };
}
test("change verifies old password, changes canonical secret, retains current session and revokes other refresh chains", async () => {
  const f = await fixture();
  const other = await f.t.run(async (ctx) => {
    const id = await ctx.db.insert("authSessions", { userId: f.userId, expirationTime: Date.now() + 600000 });
    await ctx.db.insert("authRefreshTokens", { sessionId: id, expirationTime: Date.now() + 600000 });
    return id;
  });
  await expect(
    f.owner.action(api.identity.password.index.change, { oldPassword: "wrong", newPassword: "new-password" })
  ).rejects.toThrow("verified");
  await f.owner.action(api.identity.password.index.change, {
    oldPassword: "old-password",
    newPassword: "new-password",
  });
  expect(await f.t.run((ctx) => ctx.db.get(other))).toBeNull();
  expect(await f.t.run((ctx) => ctx.db.get(f.sessionId))).not.toBeNull();
  expect(await f.t.run((ctx) => ctx.db.query("authRefreshTokens").collect())).toHaveLength(0);
  await expect(
    f.t.action((ctx) => retrieveAccount(ctx, { provider: "password", account: { id: email, secret: "old-password" } }))
  ).rejects.toThrow();
  expect(
    (
      await f.t.action((ctx) =>
        retrieveAccount(ctx, { provider: "password", account: { id: email, secret: "new-password" } })
      )
    ).user._id
  ).toBe(f.userId);
});
test("captured verified hash cannot authorize overwrite after an intervening password change or revoked session", async () => {
  const f = await fixture();
  const verified = await f.owner.action((ctx) =>
    retrieveAccount(ctx, { provider: "password", account: { id: email, secret: "old-password" } })
  );
  const guard = {
    userId: f.userId,
    sessionId: f.sessionId,
    accountId: verified.account._id,
    expectedSecret: verified.account.secret!,
  };
  await f.owner.action(api.identity.password.index.change, {
    oldPassword: "old-password",
    newPassword: "peer-password",
  });
  await expect(
    f.owner.action((ctx) =>
      modifyAccountCredentials(ctx, {
        provider: "password",
        account: { id: email, secret: "stale-password" },
        sessionGuard: guard,
      })
    )
  ).rejects.toThrow("changed");
  expect(
    (
      await f.t.action((ctx) =>
        retrieveAccount(ctx, { provider: "password", account: { id: email, secret: "peer-password" } })
      )
    ).user._id
  ).toBe(f.userId);
  const latest = await f.owner.action((ctx) =>
    retrieveAccount(ctx, { provider: "password", account: { id: email, secret: "peer-password" } })
  );
  await f.t.run((ctx) => ctx.db.delete(f.sessionId));
  await expect(
    f.owner.action((ctx) =>
      modifyAccountCredentials(ctx, {
        provider: "password",
        account: { id: email, secret: "revoked-password" },
        sessionGuard: { ...guard, expectedSecret: latest.account.secret! },
      })
    )
  ).rejects.toThrow("revoked");
});
test("set password binds to verified current identity and rejects repeated setup and account collision", async () => {
  const f = await fixture(false);
  await f.owner.action(api.identity.password.index.set, { newPassword: "new-password" });
  expect(
    (
      await f.t.action((ctx) =>
        retrieveAccount(ctx, { provider: "password", account: { id: email, secret: "new-password" } })
      )
    ).user._id
  ).toBe(f.userId);
  await expect(f.owner.action(api.identity.password.index.set, { newPassword: "again-password" })).rejects.toThrow(
    "without a password"
  );
  const g = await fixture(false);
  await g.t.action((ctx) =>
    createAccount(ctx, { provider: "password", account: { id: email, secret: "other-password" }, profile: { email } })
  );
  await expect(g.owner.action(api.identity.password.index.set, { newPassword: "takeover-password" })).rejects.toThrow(
    "already exists"
  );
});
test("set rejects revoked/ambiguous/unverified identities; unsafe logging blocks before credential operations", async () => {
  const f = await fixture(false);
  await f.t.run((ctx) => ctx.db.insert("users", { email, emailVerificationTime: 1 }));
  await expect(f.owner.action(api.identity.password.index.set, { newPassword: "new-password" })).rejects.toThrow(
    "ambiguous"
  );
  expect(await f.t.run((ctx) => ctx.db.query("authAccounts").collect())).toHaveLength(0);
  await f.t.run((ctx) => ctx.db.patch(f.userId, { emailVerificationTime: undefined }));
  await expect(f.owner.action(api.identity.password.index.set, { newPassword: "new-password" })).rejects.toThrow(
    "verified"
  );
  vi.stubEnv("AUTH_LOG_LEVEL", "DEBUG");
  await expect(f.owner.action(api.identity.password.index.set, { newPassword: "new-password" })).rejects.toThrow(
    "logging"
  );
});
test("bounded cleanup failure rolls back credential change and preserves all sessions", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    await Promise.all(
      Array.from({ length: 100 }, () =>
        ctx.db.insert("authSessions", { userId: f.userId, expirationTime: Date.now() + 600000 })
      )
    );
  });
  await expect(
    f.owner.action(api.identity.password.index.change, { oldPassword: "old-password", newPassword: "new-password" })
  ).rejects.toThrow("cleanup limit");
  expect(
    (
      await f.t.action((ctx) =>
        retrieveAccount(ctx, { provider: "password", account: { id: email, secret: "old-password" } })
      )
    ).user._id
  ).toBe(f.userId);
  expect(await f.t.run((ctx) => ctx.db.query("authSessions").collect())).toHaveLength(101);
});
test("guard rejects another actor, expired sessions and non-password provider without changing the secret", async () => {
  const f = await fixture();
  const verified = await f.owner.action((ctx) =>
    retrieveAccount(ctx, { provider: "password", account: { id: email, secret: "old-password" } })
  );
  const guard = {
    userId: f.userId,
    sessionId: f.sessionId,
    accountId: verified.account._id,
    expectedSecret: verified.account.secret!,
  };
  await expect(
    f.t.action((ctx) =>
      modifyAccountCredentials(ctx, {
        provider: "password",
        account: { id: email, secret: "new-password" },
        sessionGuard: guard,
      })
    )
  ).rejects.toThrow("session changed");
  await expect(
    f.owner.action((ctx) =>
      modifyAccountCredentials(ctx, {
        provider: "other",
        account: { id: email, secret: "new-password" },
        sessionGuard: guard,
      })
    )
  ).rejects.toThrow("Only Password");
  await f.t.run((ctx) => ctx.db.patch(f.sessionId, { expirationTime: Date.now() - 1 }));
  await expect(
    f.owner.action((ctx) =>
      modifyAccountCredentials(ctx, {
        provider: "password",
        account: { id: email, secret: "new-password" },
        sessionGuard: guard,
      })
    )
  ).rejects.toThrow("expired");
  expect(
    (
      await f.t.action((ctx) =>
        retrieveAccount(ctx, { provider: "password", account: { id: email, secret: "old-password" } })
      )
    ).account.secret
  ).toBe(verified.account.secret);
});
test("aggregate refresh budget aborts set-password before creating an account or deleting tokens", async () => {
  const f = await fixture(false);
  await f.t.run(async (ctx) => {
    const sessionId = await ctx.db.insert("authSessions", { userId: f.userId, expirationTime: Date.now() + 600000 });
    await Promise.all(
      Array.from({ length: 1001 }, () =>
        ctx.db.insert("authRefreshTokens", { sessionId, expirationTime: Date.now() + 600000 })
      )
    );
  });
  await expect(f.owner.action(api.identity.password.index.set, { newPassword: "new-password" })).rejects.toThrow(
    "Token cleanup limit"
  );
  expect(await f.t.run((ctx) => ctx.db.query("authAccounts").collect())).toHaveLength(0);
  expect(await f.t.run((ctx) => ctx.db.query("authRefreshTokens").collect())).toHaveLength(1001);
});

test.each(["summon-magic", "google"])(
  "%s onboarding can set password, retain current session, complete profile and resolve real destination",
  async (provider) => {
    const f = await fixture(false);
    const other = await f.t.run(async (ctx) => {
      await ctx.db.insert("authAccounts", {
        userId: f.userId,
        provider,
        providerAccountId: provider === "google" ? "oauth-subject" : email,
        emailVerified: email,
      });
      const sessionId = await ctx.db.insert("authSessions", { userId: f.userId, expirationTime: Date.now() + 600000 });
      await ctx.db.insert("authRefreshTokens", { sessionId, expirationTime: Date.now() + 600000 });
      await ctx.db.insert("authRefreshTokens", { sessionId: f.sessionId, expirationTime: Date.now() + 600000 });
      return sessionId;
    });
    const profile = await f.owner.query(api.identity.profile.get, {});
    await f.owner.action(api.identity.password.index.set, { newPassword: "new-password" });
    expect(await f.owner.query(api.identity.session.status, {})).toMatchObject({ valid: true });
    expect(await f.t.run((ctx) => ctx.db.get(other))).toBeNull();
    expect(await f.t.run((ctx) => ctx.db.query("authRefreshTokens").collect())).toMatchObject([
      { sessionId: f.sessionId },
    ]);
    const completed = await f.owner.mutation(api.identity.profile.completeProfile, {
      firstName: "Ada",
      lastName: "",
      displayName: "Ada",
      timezone: "UTC",
      expectedRevision: profile.revision,
    });
    expect(completed.revision).toBe(profile.revision + 1);
    expect(await f.owner.query(api.identity.preferences.destination, {})).toMatchObject({
      onboardingComplete: false,
      workspace: null,
    });
    const workspaceId = await f.owner.mutation(api.workspaces.index.create, {
      name: "First",
      slug: `password-${provider}`,
    });
    await f.owner.mutation(api.identity.onboarding.complete, { workspaceId, expectedRevision: completed.revision });
    expect(await f.owner.query(api.identity.preferences.destination, {})).toMatchObject({
      onboardingComplete: true,
      workspace: { id: workspaceId, slug: `password-${provider}` },
    });
    expect((await f.owner.query(api.identity.profile.get, {})).preferences.onboarding.profileComplete).toBe(true);
  }
);
test("disabled password policy hides onboarding capabilities and rejects both credential actions before changes", async () => {
  const f = await fixture(false);
  vi.stubEnv("ENABLE_EMAIL_PASSWORD", "0");
  expect(await f.owner.query(api.identity.password.index.capabilities, {})).toEqual({
    canSet: false,
    canChange: false,
  });
  await expect(f.owner.action(api.identity.password.index.set, { newPassword: "new-password" })).rejects.toThrow(
    "disabled"
  );
  await expect(
    f.owner.action(api.identity.password.index.change, { oldPassword: "old-password", newPassword: "new-password" })
  ).rejects.toThrow("disabled");
  expect(await f.t.run((ctx) => ctx.db.query("authAccounts").collect())).toHaveLength(0);
  expect(await f.owner.query(api.identity.session.status, {})).toMatchObject({ valid: true });
});
