import { createOrUpdateUser } from "../../user_owner";
import { afterEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import { httpRouter } from "convex/server";
import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import schema from "../../../schema";
import { internal } from "../../../_generated/api";
import { oauthConfigurations } from "../config";
import { oauthProviders, verifiedProfile } from "../providers";
const env = {
  GOOGLE_CLIENT_ID: "fixture",
  GOOGLE_CLIENT_SECRET: "fixture",
  GITHUB_CLIENT_ID: "fixture",
  GITHUB_CLIENT_SECRET: "fixture",
  GITLAB_CLIENT_ID: "fixture",
  GITLAB_CLIENT_SECRET: "fixture",
  GITEA_CLIENT_ID: "fixture",
  GITEA_CLIENT_SECRET: "fixture",
  GITEA_HOST: "https://git.fixture.test",
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function fixture() {
  return convexTest(schema, {
    "./_generated/server.ts": () => import("../../../_generated/server"),
    "./auth.ts": async () =>
      convexAuth({ callbacks: { createOrUpdateUser }, providers: [Password(), ...oauthProviders(env)] }),
    "./http.ts": async () => {
      const http = httpRouter();
      convexAuth({
        callbacks: { createOrUpdateUser },
        providers: [Password(), ...oauthProviders(env)],
      }).auth.addHttpRoutes(http);
      return { default: http };
    },
  });
}
async function profileFor(id: string, responses: unknown[], extra: Record<string, string> = {}) {
  const provider = oauthProviders({ ...env, ...extra }).find((row) => row.id === id)!;
  const mock = vi.fn();
  for (const response of responses) mock.mockResolvedValueOnce(new Response(JSON.stringify(response), { status: 200 }));
  vi.stubGlobal("fetch", mock);
  const userinfo = provider.userinfo;
  if (!userinfo || typeof userinfo !== "object" || !userinfo.request) throw new Error("Missing userinfo owner");
  const raw = await userinfo.request({ tokens: { access_token: "synthetic-access" }, provider });
  return { profile: verifiedProfile(raw), mock };
}
test("providers remain unavailable without complete trusted configuration and reject unsafe selfhost URLs", () => {
  expect(oauthConfigurations({})).toEqual([]);
  expect(oauthConfigurations(env)).toHaveLength(4);
  for (const host of [
    "http://git.test",
    "https://user:pass@git.test",
    "https://git.test/path",
    "https://git.test/?q=x",
  ])
    expect(oauthConfigurations({ ...env, GITEA_HOST: host }).some((row) => row.id === "gitea")).toBe(false);
  expect(
    oauthProviders(env).every(
      (row) =>
        row.allowDangerousEmailAccountLinking === false && row.checks?.includes("state") && row.checks.includes("pkce")
    )
  ).toBe(true);
});
test("Google and GitLab require explicit provider verification before producing normalized identity", async () => {
  expect(
    (await profileFor("google", [{ id: "1", email: "User@Example.test", verified_email: true }])).profile.email
  ).toBe("user@example.test");
  await expect(profileFor("google", [{ id: "1", email: "user@example.test" }])).rejects.toThrow("verified");
  expect(
    (await profileFor("gitlab", [{ id: 2, email: "user@example.test", confirmed_at: "2026-01-01" }])).profile.id
  ).toBe("2");
  await expect(profileFor("gitlab", [{ id: 2, email: "user@example.test", confirmed_at: null }])).rejects.toThrow(
    "verified"
  );
});
test("GitHub requires primary verified email and active configured organization; Gitea permits verified fallback", async () => {
  const emails = [
    { email: "bad@example.test", primary: true, verified: false },
    { email: "ok@example.test", primary: false, verified: true },
  ];
  await expect(profileFor("github", [{ id: 1, login: "actor" }, emails])).rejects.toThrow("verified");
  expect((await profileFor("gitea", [{ id: 1 }, emails])).profile.email).toBe("ok@example.test");
  const verified = [{ email: "ok@example.test", primary: true, verified: true }];
  await expect(
    profileFor("github", [{ id: 1, login: "actor" }, verified, { state: "pending" }], {
      GITHUB_ORGANIZATION_ID: "summon",
    })
  ).rejects.toThrow("membership");
  const result = await profileFor("github", [{ id: 1, login: "actor" }, verified, { state: "active" }], {
    GITHUB_ORGANIZATION_ID: "summon",
  });
  expect(result.profile.email).toBe("ok@example.test");
  expect(result.mock.mock.calls.at(-1)![0]).toBe("https://api.github.com/orgs/summon/memberships/actor");
  expect(result.mock.mock.calls[0]![1].redirect).toBe("error");
});
test("canonical OAuth account owner links only verified existing email and consumes state once", async () => {
  vi.stubEnv("AUTH_LOG_LEVEL", "ERROR");
  const t = fixture();
  const verified = await t.run((ctx) => ctx.db.insert("users", { email: "ok@example.test", emailVerificationTime: 1 }));
  await t.run((ctx) => ctx.db.insert("authVerifiers", { signature: "synthetic-state" }));
  const args = {
    args: {
      type: "userOAuth" as const,
      provider: "google",
      providerAccountId: "stable-provider-id",
      profile: { email: "ok@example.test", emailVerified: true },
      signature: "synthetic-state",
    },
  };
  await t.mutation(internal.auth.store, args);
  const account = await t.run((ctx) => ctx.db.query("authAccounts").first());
  expect(account?.userId).toBe(verified);
  await expect(t.mutation(internal.auth.store, args)).rejects.toThrow("Invalid state");
  await t.run((ctx) => ctx.db.insert("users", { email: "unverified@example.test" }));
  await t.run((ctx) => ctx.db.insert("authVerifiers", { signature: "second-state" }));
  await t.mutation(internal.auth.store, {
    args: {
      ...args.args,
      signature: "second-state",
      providerAccountId: "second-id",
      profile: { email: "unverified@example.test", emailVerified: true },
    },
  });
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("email"), "unverified@example.test"))
        .collect()
    )
  ).toHaveLength(2);
});
test("installed HTTP OAuth owner exchanges mock code, verifies profile, rejects state tampering and replay", async () => {
  vi.stubEnv("CONVEX_SITE_URL", "http://localhost:3211");
  vi.stubEnv("SITE_URL", "http://localhost:3000");
  vi.stubEnv("AUTH_LOG_LEVEL", "ERROR");
  const t = fixture();
  const verifier = await t.run((ctx) => ctx.db.insert("authVerifiers", {}));
  const start = await t.fetch(`/api/auth/signin/google?code=${verifier}`);
  expect(start.status).toBe(302);
  const location = new URL(start.headers.get("Location")!);
  const cookies = start.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const fetchMock = vi.fn(
    async (url: RequestInfo | URL) =>
      new Response(
        JSON.stringify(
          String(url).includes("token")
            ? { access_token: "synthetic-access", token_type: "Bearer" }
            : { id: "verified-provider", email: "http@example.test", verified_email: true }
        ),
        { headers: { "Content-Type": "application/json" } }
      )
  );
  vi.stubGlobal("fetch", fetchMock);
  const bad = await t.fetch("/api/auth/callback/google?code=synthetic&state=wrong", { headers: { Cookie: cookies } });
  expect(new URL(bad.headers.get("Location")!).searchParams.has("code")).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
  const path = `/api/auth/callback/google?code=synthetic&state=${location.searchParams.get("state")}`;
  const result = await t.fetch(path, { headers: { Cookie: cookies } });
  expect(new URL(result.headers.get("Location")!).searchParams.has("code")).toBe(true);
  expect(await t.run((ctx) => ctx.db.query("authAccounts").collect())).toHaveLength(1);
  const replay = await t.fetch(path, { headers: { Cookie: cookies } });
  expect(new URL(replay.headers.get("Location")!).searchParams.has("code")).toBe(false);
  expect(await t.run((ctx) => ctx.db.query("authAccounts").collect())).toHaveLength(1);
});

test("existing OAuth subject cannot undo a locally verified address change or attach to a new old-address owner", async () => {
  const t = fixture();
  const ids = await t.run(async (ctx) => {
    const owner = await ctx.db.insert("users", { email: "new@example.test", emailVerificationTime: 1 });
    const other = await ctx.db.insert("users", { email: "old@example.test", emailVerificationTime: 1 });
    const account = await ctx.db.insert("authAccounts", {
      userId: owner,
      provider: "google",
      providerAccountId: "immutable",
      emailVerified: "old@example.test",
    });
    await ctx.db.insert("authVerifiers", { signature: "stable-state" });
    return { owner, other, account };
  });
  await t.mutation(internal.auth.store, {
    args: {
      type: "userOAuth",
      provider: "google",
      providerAccountId: "immutable",
      profile: { email: "old@example.test", emailVerified: true },
      signature: "stable-state",
    },
  });
  await t.run(async (ctx) => {
    expect(await ctx.db.get(ids.owner)).toMatchObject({ email: "new@example.test" });
    expect(await ctx.db.get(ids.account)).toMatchObject({
      userId: ids.owner,
      providerAccountId: "immutable",
      emailVerified: "old@example.test",
    });
    expect(await ctx.db.get(ids.other)).toMatchObject({ email: "old@example.test" });
  });
});

test("disabled signup blocks new OAuth identities at the same canonical user owner", async () => {
  const t = fixture();
  vi.stubEnv("ENABLE_SIGNUP", "0");
  await t.run((ctx) => ctx.db.insert("authVerifiers", { signature: "disabled-state" }));
  await expect(
    t.mutation(internal.auth.store, {
      args: {
        type: "userOAuth",
        provider: "google",
        providerAccountId: "new-subject",
        profile: { email: "blocked@example.test", emailVerified: true },
        signature: "disabled-state",
      },
    })
  ).rejects.toThrow("Sign up is disabled");
  expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(0);
  expect(await t.run((ctx) => ctx.db.query("authAccounts").collect())).toHaveLength(0);
});
