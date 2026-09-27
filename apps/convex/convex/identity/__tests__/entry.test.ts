import { generateKeyPairSync } from "node:crypto";
import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { createOrUpdateUser } from "../user_owner";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { convexTest } from "convex-test";
import schema from "../../schema";
afterEach(() => vi.unstubAllEnvs());
test("email first discovery reflects actual password/magic policy and never invents a fallback", async () => {
  const f = await workspaceJourney();
  vi.stubEnv("AUTH_RESEND_KEY", "fixture");
  vi.stubEnv("EMAIL_FROM", "fixture@example.test");
  vi.stubEnv("SITE_URL", "https://example.test");
  expect(await f.t.query(api.identity.entry.check, { email: " NEW@example.test " })).toMatchObject({
    email: "new@example.test",
    existing: false,
    method: "magic",
    canSignUp: true,
  });
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.userId, { email: "owner@example.test" });
    await ctx.db.insert("authAccounts", {
      userId: f.userId,
      provider: "password",
      providerAccountId: "owner@example.test",
      secret: "hash",
    });
  });
  expect(await f.t.query(api.identity.entry.check, { email: "owner@example.test" })).toMatchObject({
    existing: true,
    method: "password",
    canSignUp: false,
  });
  vi.stubEnv("ENABLE_EMAIL_PASSWORD", "0");
  expect((await f.t.query(api.identity.entry.check, { email: "owner@example.test" })).method).toBe("magic");
  vi.stubEnv("ENABLE_MAGIC_LINK_LOGIN", "0");
  expect((await f.t.query(api.identity.entry.check, { email: "owner@example.test" })).method).toBeNull();
});
test("disabled signup permits only live workspace invitations from a current issuer", async () => {
  const f = await workspaceJourney();
  vi.stubEnv("ENABLE_SIGNUP", "0");
  const email = "invite@example.test";
  expect((await f.t.query(api.identity.entry.check, { email })).canSignUp).toBe(false);
  const id = await f.owner.mutation(internal.invitations.index.issue, {
    workspaceId: f.workspaceId,
    projectId: null,
    email,
    role: "member",
    tokenHash: "fixture",
  });
  expect((await f.t.query(api.identity.entry.check, { email })).canSignUp).toBe(true);
  await f.t.run((ctx) => ctx.db.insert("accountRestrictions", { userId: f.userId, deactivatedAt: Date.now() }));
  expect((await f.t.query(api.identity.entry.check, { email })).canSignUp).toBe(false);
  await f.t.run((ctx) => ctx.db.patch(id, { expiresAt: Date.now() - 1 }));
  expect((await f.t.query(api.identity.entry.check, { email })).canSignUp).toBe(false);
});
test("installed password signup cannot bypass disabled signup while an existing account still authenticates", async () => {
  vi.stubEnv("AUTH_LOG_LEVEL", "ERROR");
  const t = convexTest(schema, {
    "./_generated/server.ts": () => import("../../_generated/server"),
    "./auth.ts": async () => convexAuth({ callbacks: { createOrUpdateUser }, providers: [Password()] }),
  });
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  vi.stubEnv("JWT_PRIVATE_KEY", privateKey.export({ format: "pem", type: "pkcs8" }).toString());
  vi.stubEnv("CONVEX_SITE_URL", "http://localhost:3211");
  vi.stubEnv("ENABLE_SIGNUP", "1");
  await t.action(api.auth.signIn, {
    provider: "password",
    params: { flow: "signUp", email: "existing@example.test", password: "fixture-password" },
  });
  // auth.store invokes the same canonical callback before creating the credentials account.
  vi.stubEnv("ENABLE_SIGNUP", "0");
  await expect(
    t.action(api.auth.signIn, {
      provider: "password",
      params: { flow: "signUp", email: "new@example.test", password: "fixture-password" },
    })
  ).rejects.toThrow("Sign up is disabled");
  expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(1);
  expect(await t.run((ctx) => ctx.db.query("authAccounts").collect())).toHaveLength(1);
  expect(
    (
      await t.action(api.auth.signIn, {
        provider: "password",
        params: { flow: "signIn", email: "existing@example.test", password: "fixture-password" },
      })
    ).tokens
  ).not.toBeNull();
});
