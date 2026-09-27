import { createOrUpdateUser } from "../../user_owner";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { convexTest } from "convex-test";
import { convexAuth, createAccount, retrieveAccount } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import schema from "../../../schema";
import { api } from "../../../_generated/api";
import { verificationEmail } from "../provider";
import { mailConfiguration } from "../config";
const modules = {
  "./_generated/server.ts": () => import("../../../_generated/server"),
};
const prefix = "./";
const email = "fixture@example.test";
const sent: { to: string[]; text: string }[] = [];
function fixture() {
  return convexTest(schema, {
    ...modules,
    [`${prefix}auth.ts`]: async () =>
      convexAuth({
        callbacks: { createOrUpdateUser },
        providers: [
          Password({ reset: verificationEmail("reset"), verify: verificationEmail("verify") }),
          verificationEmail("magic"),
        ],
      }),
  });
}
beforeEach(() => {
  sent.length = 0;
  vi.stubEnv("AUTH_RESEND_KEY", "synthetic-only");
  vi.stubEnv("EMAIL_FROM", "Summon <fixture@example.test>");
  vi.stubEnv("SITE_URL", "http://localhost:3000");
  vi.stubEnv("CONVEX_SITE_URL", "http://localhost:3211");
  vi.stubEnv("AUTH_LOG_LEVEL", "ERROR");
  vi.stubEnv("AUTH_LOG_SECRETS", "false");
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  vi.stubEnv("JWT_PRIVATE_KEY", privateKey.export({ format: "pem", type: "pkcs8" }).toString());
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, init) => {
      sent.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ id: "fixture" }), { status: 200 });
    })
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function code() {
  return sent.at(-1)!.text.split("\n\n")[1];
}
test("known, unknown and sender failure have identical public reset responses; failure logs no email or token", async () => {
  const t = fixture();
  await t.action((ctx) =>
    createAccount(ctx, { provider: "password", account: { id: email, secret: "fixture-password" }, profile: { email } })
  );
  const known = await t.action(api.auth.signIn, { provider: "password", params: { flow: "reset", email } });
  const unknown = await t.action(api.auth.signIn, {
    provider: "password",
    params: { flow: "reset", email: "absent@example.test" },
  });
  expect(known).toEqual({ tokens: null });
  expect(unknown).toEqual(known);
  expect(sent).toHaveLength(1);
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(fetch).mockResolvedValueOnce(new Response("Rejected", { status: 503 }));
  const failed = await t.action(api.auth.signIn, { provider: "password", params: { flow: "reset", email } });
  expect(failed).toEqual(known);
  expect(log).toHaveBeenCalledWith("Password reset request could not be completed.");
});
test("valid reset changes canonical password, rejects invalid and replay codes, and invalidates prior sessions", async () => {
  const t = fixture();
  const account = await t.action((ctx) =>
    createAccount(ctx, { provider: "password", account: { id: email, secret: "fixture-password" }, profile: { email } })
  );
  const old = await t.run((ctx) =>
    ctx.db.insert("authSessions", { userId: account.user._id, expirationTime: Date.now() + 60000 })
  );
  await t.action(api.auth.signIn, { provider: "password", params: { flow: "reset", email } });
  const token = code();
  await expect(
    t.action(api.auth.signIn, {
      provider: "password",
      params: { flow: "reset-verification", email, code: "invalid", newPassword: "new-fixture-password" },
    })
  ).rejects.toThrow();
  const args = {
    provider: "password",
    params: { flow: "reset-verification", email, code: token, newPassword: "new-fixture-password" },
  };
  expect((await t.action(api.auth.signIn, args)).tokens).not.toBeNull();
  expect(await t.run((ctx) => ctx.db.get(old))).toBeNull();
  expect(
    await t.action((ctx) =>
      retrieveAccount(ctx, { provider: "password", account: { id: email, secret: "new-fixture-password" } })
    )
  ).not.toBeNull();
  await expect(t.action(api.auth.signIn, args)).rejects.toThrow();
});
test("expired reset code cannot update credentials", async () => {
  const t = fixture();
  await t.action((ctx) =>
    createAccount(ctx, { provider: "password", account: { id: email, secret: "fixture-password" }, profile: { email } })
  );
  await t.action(api.auth.signIn, { provider: "password", params: { flow: "reset", email } });
  const token = code();
  await t.run(async (ctx) => {
    const rows = await ctx.db.query("authVerificationCodes").collect();
    await Promise.all(rows.map((row) => ctx.db.patch(row._id, { expirationTime: Date.now() - 1 })));
  });
  await expect(
    t.action(api.auth.signIn, {
      provider: "password",
      params: { flow: "reset-verification", email, code: token, newPassword: "new-fixture-password" },
    })
  ).rejects.toThrow();
  expect(
    await t.action((ctx) =>
      retrieveAccount(ctx, { provider: "password", account: { id: email, secret: "fixture-password" } })
    )
  ).not.toBeNull();
});
test("signup requires email code and canonical verification is single use", async () => {
  const t = fixture();
  expect(
    (
      await t.action(api.auth.signIn, {
        provider: "password",
        params: { flow: "signUp", email, password: "fixture-password" },
      })
    ).tokens
  ).toBeNull();
  expect(await t.run((ctx) => ctx.db.query("users").first())).toMatchObject({ email });
  expect((await t.run((ctx) => ctx.db.query("users").first()))?.emailVerificationTime).toBeUndefined();
  const args = { provider: "password", params: { flow: "email-verification", email, code: code() } };
  expect((await t.action(api.auth.signIn, args)).tokens).not.toBeNull();
  expect((await t.run((ctx) => ctx.db.query("users").first()))?.emailVerificationTime).toBeTypeOf("number");
  await expect(t.action(api.auth.signIn, args)).rejects.toThrow();
});
test("unconfigured mail is unavailable and never calls transport", () => {
  vi.stubEnv("AUTH_RESEND_KEY", "");
  expect(mailConfiguration(process.env)).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});
test("issuance limit is atomic, separate from sign-in failures, and leaves last usable code intact", async () => {
  const t = fixture();
  await t.action((ctx) =>
    createAccount(ctx, { provider: "password", account: { id: email, secret: "fixture-password" }, profile: { email } })
  );
  const request = { provider: "password", params: { flow: "reset", email } };
  await t.action(api.auth.signIn, request);
  await t.action(api.auth.signIn, request);
  await t.action(api.auth.signIn, request);
  const token = code();
  const before = await t.run((ctx) => ctx.db.query("authVerificationCodes").collect());
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(await t.action(api.auth.signIn, request)).toEqual({ tokens: null });
  expect(sent).toHaveLength(3);
  expect(await t.run((ctx) => ctx.db.query("authVerificationCodes").collect())).toEqual(before);
  const limits = await t.run((ctx) => ctx.db.query("authRateLimits").collect());
  expect(limits).toHaveLength(1);
  expect(limits[0].identifier).toMatch(/^mail-issuance:/);
  expect(limits[0].identifier).not.toContain(email);
  expect(log).toHaveBeenCalledWith("Password reset request could not be completed.");
  expect(
    (
      await t.action(api.auth.signIn, {
        provider: "password",
        params: { flow: "reset-verification", email, code: token, newPassword: "new-fixture-password" },
      })
    ).tokens
  ).not.toBeNull();
});
test("magic request has the same public outcome for new and verified existing accounts and signs into canonical user", async () => {
  const t = fixture();
  const existing = await t.run((ctx) => ctx.db.insert("users", { email, emailVerificationTime: 1 }));
  const known = await t.action(api.auth.signIn, { provider: "summon-magic", params: { email } });
  const token = code();
  const unknown = await t.action(api.auth.signIn, { provider: "summon-magic", params: { email: "new@example.test" } });
  expect(known).toEqual({ started: true });
  expect(unknown).toEqual(known);
  expect(sent.at(-1)!.text).toContain("10 minutes");
  const newToken = code();
  expect(
    (await t.action(api.auth.signIn, { provider: "summon-magic", params: { email, code: token } })).tokens
  ).not.toBeNull();
  const sessions = await t.run((ctx) => ctx.db.query("authSessions").collect());
  expect(sessions[0]!.userId).toBe(existing);
  expect(
    (
      await t.action(api.auth.signIn, {
        provider: "summon-magic",
        params: { email: "new@example.test", code: newToken },
      })
    ).tokens
  ).not.toBeNull();
  const created = await t.run((ctx) =>
    ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), "new@example.test"))
      .first()
  );
  expect(created?.emailVerificationTime).toBeTypeOf("number");
  await expect(
    t.action(api.auth.signIn, { provider: "summon-magic", params: { email, code: token } })
  ).rejects.toThrow();
});
test("magic codes reject wrong email and expiry and share issuance budget with password reset", async () => {
  const t = fixture();
  await t.action((ctx) =>
    createAccount(ctx, {
      provider: "password",
      account: { id: email, secret: "fixture-password" },
      profile: { email, emailVerificationTime: 1 },
    })
  );
  await t.action(api.auth.signIn, { provider: "summon-magic", params: { email } });
  const token = code();
  await expect(
    t.action(api.auth.signIn, { provider: "summon-magic", params: { email: "wrong@example.test", code: token } })
  ).rejects.toThrow();
  await t.action(api.auth.signIn, { provider: "password", params: { flow: "reset", email } });
  await t.action(api.auth.signIn, { provider: "summon-magic", params: { email } });
  await expect(t.action(api.auth.signIn, { provider: "summon-magic", params: { email } })).rejects.toThrow("limit");
  expect(sent).toHaveLength(3);
  const last = code();
  await t.run(async (ctx) => {
    const rows = await ctx.db.query("authVerificationCodes").collect();
    await Promise.all(rows.map((row) => ctx.db.patch(row._id, { expirationTime: Date.now() - 1 })));
  });
  await expect(
    t.action(api.auth.signIn, { provider: "summon-magic", params: { email, code: last } })
  ).rejects.toThrow();
  expect(await t.run((ctx) => ctx.db.query("authSessions").collect())).toHaveLength(0);
});

test("disabled signup blocks a new magic account without sending mail or creating identity rows", async () => {
  const t = fixture();
  vi.stubEnv("ENABLE_SIGNUP", "0");
  await expect(
    t.action(api.auth.signIn, { provider: "summon-magic", params: { email: "blocked@example.test" } })
  ).rejects.toThrow("Sign up is disabled");
  expect(sent).toHaveLength(0);
  expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(0);
  expect(await t.run((ctx) => ctx.db.query("authAccounts").collect())).toHaveLength(0);
});
