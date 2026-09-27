import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
async function fixture() {
  const f = await workspaceJourney();
  const currentId = await f.t.run((ctx) =>
    ctx.db.insert("authSessions", { userId: f.userId, expirationTime: Date.now() + 60000 })
  );
  const current = f.t.withIdentity({ subject: `${f.userId}|${currentId}` });
  return { ...f, current, currentId };
}
test("session list is owner-private, paginated and exposes no refresh identifiers or credential data", async () => {
  const f = await fixture();
  const other = await f.t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Other" });
    return ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 60000 });
  });
  const result = await f.current.query(api.sessions.index.list, { paginationOpts: { cursor: null, numItems: 1 } });
  expect(result.page).toHaveLength(1);
  expect(result.page[0]).toEqual({
    id: f.currentId,
    createdAt: expect.any(Number),
    expiresAt: expect.any(Number),
    isCurrent: true,
  });
  expect(result.revocationNotice).toContain("immediately blocks");
  await expect(f.current.mutation(api.sessions.index.revoke, { sessionId: other })).rejects.toThrow("not found");
  expect(await f.t.run((ctx) => ctx.db.get(other))).not.toBeNull();
});
test("revoking a different session atomically removes every refresh descendant and retains current session", async () => {
  const f = await fixture();
  const target = await f.t.run(async (ctx) => {
    const sessionId = await ctx.db.insert("authSessions", { userId: f.userId, expirationTime: Date.now() + 60000 });
    const parent = await ctx.db.insert("authRefreshTokens", { sessionId, expirationTime: Date.now() + 60000 });
    await ctx.db.insert("authRefreshTokens", {
      sessionId,
      parentRefreshTokenId: parent,
      firstUsedTime: Date.now(),
      expirationTime: Date.now() + 60000,
    });
    return sessionId;
  });
  expect(await f.current.mutation(api.sessions.index.revoke, { sessionId: target })).toEqual({ revokedCurrent: false });
  expect(await f.t.run((ctx) => ctx.db.get(target))).toBeNull();
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", target))
        .collect()
    )
  ).toEqual([]);
  expect(await f.t.run((ctx) => ctx.db.get(f.currentId))).not.toBeNull();
  const revoked = f.t.withIdentity({ subject: `${f.userId}|${target}` });
  await expect(
    revoked.query(api.sessions.index.list, { paginationOpts: { cursor: null, numItems: 20 } })
  ).rejects.toThrow("expired");
});
test("expired or mismatched current sessions cannot manage sessions; current revoke denies subsequent session operations", async () => {
  const f = await fixture();
  const strangerId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Stranger" }));
  const mismatched = f.t.withIdentity({ subject: `${strangerId}|${f.currentId}` });
  await expect(
    mismatched.query(api.sessions.index.list, { paginationOpts: { cursor: null, numItems: 20 } })
  ).rejects.toThrow("expired");
  await f.t.run((ctx) => ctx.db.patch(f.currentId, { expirationTime: Date.now() - 1 }));
  await expect(f.current.mutation(api.sessions.index.revoke, { sessionId: f.currentId })).rejects.toThrow("expired");
  await f.t.run((ctx) => ctx.db.patch(f.currentId, { expirationTime: Date.now() + 60000 }));
  expect(await f.current.mutation(api.sessions.index.revoke, { sessionId: f.currentId })).toEqual({
    revokedCurrent: true,
  });
  await expect(
    f.current.query(api.sessions.index.list, { paginationOpts: { cursor: null, numItems: 20 } })
  ).rejects.toThrow("expired");
});
test("oversized refresh chain fails before any deletion", async () => {
  const f = await fixture();
  const target = await f.t.run(async (ctx) => {
    const sessionId = await ctx.db.insert("authSessions", { userId: f.userId, expirationTime: Date.now() + 60000 });
    await Promise.all(
      Array.from({ length: 1001 }, () =>
        ctx.db.insert("authRefreshTokens", { sessionId, expirationTime: Date.now() + 60000 })
      )
    );
    return sessionId;
  });
  await expect(f.current.mutation(api.sessions.index.revoke, { sessionId: target })).rejects.toThrow("cleanup limit");
  expect(await f.t.run((ctx) => ctx.db.get(target))).not.toBeNull();
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", target))
        .collect()
    )
  ).toHaveLength(1001);
});
