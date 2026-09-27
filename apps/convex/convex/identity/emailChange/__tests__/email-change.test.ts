import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createHash } from "node:crypto";
import { api, internal } from "../../../_generated/api";
import { workspaceJourney } from "../../../../test-support/fixtures";
const digest = (nonce: string, code = "123456") => createHash("sha256").update(`${nonce}:${code}`).digest("hex");
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 200 }))
  );
  vi.stubEnv("AUTH_RESEND_KEY", "synthetic");
  vi.stubEnv("EMAIL_FROM", "fixture@example.test");
  vi.stubEnv("SITE_URL", "http://localhost:3000");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function fixture() {
  const f = await workspaceJourney();
  const records = await f.t.run(async (ctx) => {
    await ctx.db.patch(f.userId, { email: "old@example.test", emailVerificationTime: 1 });
    const sessionId = await ctx.db.insert("authSessions", { userId: f.userId, expirationTime: Date.now() + 3600000 });
    const passwordId = await ctx.db.insert("authAccounts", {
      userId: f.userId,
      provider: "password",
      providerAccountId: "old@example.test",
      secret: "hash",
    });
    const magicId = await ctx.db.insert("authAccounts", {
      userId: f.userId,
      provider: "summon-magic",
      providerAccountId: "old@example.test",
      emailVerified: "old@example.test",
    });
    const oauthId = await ctx.db.insert("authAccounts", {
      userId: f.userId,
      provider: "github",
      providerAccountId: "immutable-subject",
      emailVerified: "old@example.test",
    });
    return { sessionId, passwordId, magicId, oauthId };
  });
  const proof = { sessionId: records.sessionId, accountId: records.passwordId, expectedSecret: "hash" };
  return { ...f, ...records, proof, actor: f.t.withIdentity({ subject: `${f.userId}|${records.sessionId}` }) };
}
test("verified change preserves OAuth claims, renames email login owners and revokes all sessions/codes atomically", async () => {
  const f = await fixture();
  await f.actor.mutation(internal.identity.emailChange.index.begin, {
    ...f.proof,
    newEmail: " NEW@example.test ",
    nonce: "first",
    digest: digest("first"),
  });
  await f.t.run(async (ctx) => {
    await ctx.db.insert("authVerificationCodes", {
      accountId: f.passwordId,
      provider: "summon-reset",
      code: "old-code",
      expirationTime: Date.now() + 10000,
    });
    await ctx.db.insert("authRefreshTokens", { sessionId: f.sessionId, expirationTime: Date.now() + 10000 });
  });
  expect(
    await f.actor.mutation(internal.identity.emailChange.index.commit, {
      ...f.proof,
      nonce: "first",
      digest: digest("first"),
    })
  ).toEqual({ changed: true });
  await f.t.run(async (ctx) => {
    expect(await ctx.db.get(f.userId)).toMatchObject({
      email: "new@example.test",
      emailVerificationTime: expect.any(Number),
    });
    expect(await ctx.db.get(f.passwordId)).toMatchObject({
      providerAccountId: "new@example.test",
      secret: "hash",
      emailVerified: "new@example.test",
    });
    expect(await ctx.db.get(f.magicId)).toMatchObject({ providerAccountId: "new@example.test" });
    expect(await ctx.db.get(f.oauthId)).toMatchObject({
      providerAccountId: "immutable-subject",
      emailVerified: "old@example.test",
    });
    expect(await ctx.db.query("authVerificationCodes").collect()).toHaveLength(0);
    expect(await ctx.db.query("authRefreshTokens").collect()).toHaveLength(0);
    expect(await ctx.db.query("emailChangeNotices").collect()).toHaveLength(2);
  });
  expect(await f.actor.query(api.identity.session.status, {})).toEqual({ valid: false });
  await expect(
    f.actor.mutation(internal.identity.emailChange.index.commit, {
      ...f.proof,
      nonce: "first",
      digest: digest("first"),
    })
  ).rejects.toThrow("Sign in again");
});
test("wrong codes persist attempts and lock the challenge; expiry and replacement invalidate captured codes", async () => {
  vi.useFakeTimers();
  const f = await fixture();
  const begin = (nonce: string) =>
    f.actor.mutation(internal.identity.emailChange.index.begin, {
      ...f.proof,
      newEmail: "new@example.test",
      nonce,
      digest: digest(nonce),
    });
  await begin("first");
  for (let i = 0; i < 5; i++) {
    // Each attempt must commit before the next attempt.
    expect(
      // eslint-disable-next-line no-await-in-loop
      await f.actor.mutation(internal.identity.emailChange.index.commit, {
        ...f.proof,
        nonce: "first",
        digest: "wrong",
      })
    ).toEqual({ changed: false });
  }
  expect(
    await f.actor.mutation(internal.identity.emailChange.index.commit, {
      ...f.proof,
      nonce: "first",
      digest: digest("first"),
    })
  ).toEqual({ changed: false });
  await expect(begin("second")).rejects.toThrow("one minute");
  vi.advanceTimersByTime(60001);
  await begin("second");
  expect(
    await f.actor.mutation(internal.identity.emailChange.index.commit, {
      ...f.proof,
      nonce: "first",
      digest: digest("first"),
    })
  ).toEqual({ changed: false });
  vi.advanceTimersByTime(600001);
  expect(
    await f.actor.mutation(internal.identity.emailChange.index.commit, {
      ...f.proof,
      nonce: "second",
      digest: digest("second"),
    })
  ).toEqual({ changed: false });
  await begin("third");
  vi.advanceTimersByTime(60001);
  await expect(begin("fourth")).rejects.toThrow("hourly");
});
test.each(["user", "account"])(
  "collision at commit (%s) and changed password proof preserve source and sessions",
  async (kind) => {
    const f = await fixture();
    await f.actor.mutation(internal.identity.emailChange.index.begin, {
      ...f.proof,
      newEmail: "new@example.test",
      nonce: "first",
      digest: digest("first"),
    });
    const args = { ...f.proof, nonce: "first", digest: digest("first") };
    await f.t.run((ctx) => ctx.db.patch(f.passwordId, { secret: "newer-hash" }));
    await expect(f.actor.mutation(internal.identity.emailChange.index.commit, args)).rejects.toThrow(
      "Password changed"
    );
    await f.t.run(async (ctx) => {
      await ctx.db.patch(f.passwordId, { secret: "hash" });
      const userId = await ctx.db.insert("users", kind === "user" ? { email: "new@example.test" } : {});
      if (kind === "account")
        await ctx.db.insert("authAccounts", {
          userId,
          provider: "summon-magic",
          providerAccountId: "new@example.test",
        });
    });
    await expect(f.actor.mutation(internal.identity.emailChange.index.commit, args)).rejects.toThrow("unavailable");
    expect(await f.actor.query(api.identity.session.status, {})).toMatchObject({ valid: true });
    expect(await f.t.run((ctx) => ctx.db.get(f.userId))).toMatchObject({ email: "old@example.test" });
    expect(await f.t.run((ctx) => ctx.db.query("emailChangeNotices").collect())).toHaveLength(0);
  }
);
test("challenge is session-bound and unconfigured sender cannot issue a reservation", async () => {
  const f = await fixture();
  vi.stubEnv("AUTH_RESEND_KEY", "");
  await expect(
    f.actor.mutation(internal.identity.emailChange.index.begin, {
      ...f.proof,
      newEmail: "new@example.test",
      nonce: "first",
      digest: digest("first"),
    })
  ).rejects.toThrow("not configured");
  expect(await f.t.run((ctx) => ctx.db.query("emailChangeChallenges").collect())).toHaveLength(0);
  vi.stubEnv("AUTH_RESEND_KEY", "synthetic");
  await f.actor.mutation(internal.identity.emailChange.index.begin, {
    ...f.proof,
    newEmail: "new@example.test",
    nonce: "first",
    digest: digest("first"),
  });
  const sessionId = await f.t.run((ctx) =>
    ctx.db.insert("authSessions", { userId: f.userId, expirationTime: Date.now() + 60000 })
  );
  expect(
    await f.t
      .withIdentity({ subject: `${f.userId}|${sessionId}` })
      .mutation(internal.identity.emailChange.index.commit, {
        ...f.proof,
        sessionId,
        nonce: "first",
        digest: digest("first"),
      })
  ).toEqual({ changed: false });
});

test("public actions use mocked Resend delivery, fresh session proof and single-use confirmation", async () => {
  const f = await fixture();
  await f.t.run((ctx) => ctx.db.delete(f.passwordId));
  let code = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      expect(body.to).toEqual(["new@example.test"]);
      code = body.text.split("\n\n")[1];
      return new Response("{}", { status: 200 });
    })
  );
  const request = await f.actor.action(api.identity.emailChange.actions.request, { newEmail: "new@example.test" });
  expect(code).toMatch(/^\d{6}$/);
  expect(
    await f.actor.action(api.identity.emailChange.actions.confirm, { challenge: request.challenge, code })
  ).toEqual({ changed: true, signInRequired: true });
  expect(await f.actor.query(api.identity.session.status, {})).toEqual({ valid: false });
});
test("sender failure invalidates the issued challenge without rolling back cooldown", async () => {
  const f = await fixture();
  await f.t.run((ctx) => ctx.db.delete(f.passwordId));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("unavailable", { status: 503 }))
  );
  await expect(
    f.actor.action(api.identity.emailChange.actions.request, { newEmail: "new@example.test" })
  ).rejects.toThrow("could not be sent");
  expect(await f.t.run((ctx) => ctx.db.query("emailChangeChallenges").unique())).toMatchObject({
    active: false,
    issuedCount: 1,
  });
  await expect(
    f.actor.action(api.identity.emailChange.actions.request, { newEmail: "new@example.test" })
  ).rejects.toThrow("one minute");
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("post-commit old/new notices retry only three times with stable provider idempotency keys", async () => {
  const f = await fixture();
  await f.actor.mutation(internal.identity.emailChange.index.begin, {
    ...f.proof,
    newEmail: "new@example.test",
    nonce: "first",
    digest: digest("first"),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("unavailable", { status: 503 }))
  );
  await f.actor.mutation(internal.identity.emailChange.index.commit, {
    ...f.proof,
    nonce: "first",
    digest: digest("first"),
  });
  await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  const jobs = await f.t.run((ctx) => ctx.db.query("emailChangeNotices").collect());
  expect(new Set(jobs.map((job) => job.recipient))).toEqual(new Set(["new@example.test", "old@example.test"]));
  expect(jobs.every((job) => job.status === "failed" && job.attempts === 3)).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(6);
  const keys = vi.mocked(fetch).mock.calls.map((call) => new Headers(call[1]?.headers).get("Idempotency-Key"));
  expect(new Set(keys).size).toBe(2);
  expect(keys.every((key) => key?.startsWith("email-change-"))).toBe(true);
  await f.t.action(internal.identity.emailChange.notifications.deliver, { id: jobs[0]._id });
  expect(fetch).toHaveBeenCalledTimes(6);
});
