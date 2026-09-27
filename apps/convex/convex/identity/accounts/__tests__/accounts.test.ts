import { afterEach, expect, test, vi } from "vitest";
import { workspaceJourney } from "../../../../test-support/fixtures";
import { api } from "../../../_generated/api";
afterEach(() => vi.unstubAllEnvs());
test("inventory is current-user paginated metadata and never returns credential or provider account identifiers", async () => {
  const f = await workspaceJourney();
  await f.t.run(async (ctx) => {
    await ctx.db.insert("authAccounts", {
      userId: f.userId,
      provider: "password",
      providerAccountId: "private@example.test",
      secret: "synthetic-hash",
    });
    await ctx.db.insert("authAccounts", {
      userId: f.userId,
      provider: "unknown",
      providerAccountId: "private-provider-id",
    });
    const other = await ctx.db.insert("users", {});
    await ctx.db.insert("authAccounts", {
      userId: other,
      provider: "password",
      providerAccountId: "other@example.test",
      secret: "other-hash",
    });
  });
  const first = await f.owner.query(api.identity.accounts.index.list, {
    paginationOpts: { cursor: null, numItems: 1 },
  });
  expect(first.page).toHaveLength(1);
  expect(first.isDone).toBe(false);
  expect(new Set(Object.keys(first.page[0]!))).toEqual(
    new Set(["configuredForSignIn", "connectedAt", "id", "name", "provider"])
  );
  const second = await f.owner.query(api.identity.accounts.index.list, {
    paginationOpts: { cursor: first.continueCursor, numItems: 1 },
  });
  expect(second.page).toHaveLength(1);
  expect(second.isDone).toBe(true);
  const rows = [...first.page, ...second.page];
  expect(rows.find((row) => row.provider === "password")?.configuredForSignIn).toBe(true);
  expect(rows.find((row) => row.provider === "unknown")?.configuredForSignIn).toBe(false);
  expect(JSON.stringify(rows)).not.toMatch(/private@|private-provider|synthetic-hash|other@|other-hash/);
});
test("disabled OAuth provider stays visible without claiming usable login and capability follows server config", async () => {
  const f = await workspaceJourney();
  await f.t.run((ctx) =>
    ctx.db.insert("authAccounts", { userId: f.userId, provider: "github", providerAccountId: "private-id" })
  );
  vi.stubEnv("GITHUB_CLIENT_ID", "");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "");
  expect(
    (await f.owner.query(api.identity.accounts.index.list, { paginationOpts: { cursor: null, numItems: 10 } })).page[0]!
      .configuredForSignIn
  ).toBe(false);
  vi.stubEnv("GITHUB_CLIENT_ID", "synthetic");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "synthetic");
  expect(
    (await f.owner.query(api.identity.accounts.index.list, { paginationOpts: { cursor: null, numItems: 10 } })).page[0]!
      .configuredForSignIn
  ).toBe(true);
});
test("anonymous and revoked-session inventory reads are rejected", async () => {
  const f = await workspaceJourney();
  await expect(
    f.t.query(api.identity.accounts.index.list, { paginationOpts: { cursor: null, numItems: 10 } })
  ).rejects.toThrow("session");
  await f.t.run(async (ctx) => {
    const sessions = await ctx.db.query("authSessions").collect();
    await Promise.all(sessions.map((row) => ctx.db.delete(row._id)));
  });
  await expect(
    f.owner.query(api.identity.accounts.index.list, { paginationOpts: { cursor: null, numItems: 10 } })
  ).rejects.toThrow("session");
});
