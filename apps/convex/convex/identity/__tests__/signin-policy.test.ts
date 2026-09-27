import { afterEach, expect, test, vi } from "vitest";
import { signInPolicy } from "../signin_policy";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
afterEach(() => vi.unstubAllEnvs());
const mail = { AUTH_RESEND_KEY: "fixture", EMAIL_FROM: "test@example.test", SITE_URL: "https://example.test" };
test("runtime defaults preserve password and configured magic while explicit disabled flags prevent recovery advertising", () => {
  expect(signInPolicy({})).toEqual({ password: true, magic: false, passwordReset: false, emailVerification: false });
  expect(signInPolicy(mail)).toEqual({ password: true, magic: true, passwordReset: true, emailVerification: true });
  expect(signInPolicy({ ...mail, ENABLE_EMAIL_PASSWORD: "0", ENABLE_MAGIC_LINK_LOGIN: "0" })).toEqual({
    password: false,
    magic: false,
    passwordReset: false,
    emailVerification: false,
  });
  expect(signInPolicy({ ...mail, ENABLE_EMAIL_PASSWORD: "0" }).magic).toBe(true);
});
test("anonymous availability and connected password projection use the same disabled policy", async () => {
  const f = await workspaceJourney();
  await f.t.run((ctx) =>
    ctx.db.insert("authAccounts", {
      userId: f.userId,
      provider: "password",
      providerAccountId: "policy@example.test",
      secret: "fixture-hash",
    })
  );
  vi.stubEnv("ENABLE_EMAIL_PASSWORD", "0");
  vi.stubEnv("ENABLE_MAGIC_LINK_LOGIN", "0");
  const available = await f.t.query(api.identity.mail.availability.get, {});
  expect(available.passwordSignIn).toBe(false);
  expect(available.passwordReset).toBe(false);
  expect(available.magicCode).toBe(false);
  const accounts = await f.owner.query(api.identity.accounts.index.list, {
    paginationOpts: { cursor: null, numItems: 10 },
  });
  expect(accounts.page.find((row) => row.provider === "password")?.configuredForSignIn).toBe(false);
});
