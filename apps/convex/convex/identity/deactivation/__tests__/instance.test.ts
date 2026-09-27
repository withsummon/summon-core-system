import { expect, test } from "vitest";
import { api, internal } from "../../../_generated/api";
import { workspaceJourney } from "../../../../test-support/fixtures";
test("operator bootstrap requires verified exact identity and cannot repeat after initialization", async () => {
  const f = await workspaceJourney();
  const args = { userId: f.userId, expectedEmail: "operator@example.test" };
  await expect(f.t.mutation(internal.identity.instance.index.bootstrap, args)).rejects.toThrow("verified operator");
  await f.t.run((ctx) => ctx.db.patch(f.userId, { email: args.expectedEmail, emailVerificationTime: Date.now() }));
  await expect(
    f.t.mutation(internal.identity.instance.index.bootstrap, { ...args, expectedEmail: "wrong@example.test" })
  ).rejects.toThrow("exact email");
  await f.t.mutation(internal.identity.instance.index.bootstrap, args);
  expect(await f.owner.query(api.identity.instance.index.me, {})).toEqual({ isInstanceAdmin: true });
  await expect(f.t.mutation(internal.identity.instance.index.bootstrap, args)).rejects.toThrow("already initialized");
  await f.t.run(async (ctx) => {
    const rows = await ctx.db.query("instanceAdmins").collect();
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
  });
  await expect(f.t.mutation(internal.identity.instance.index.bootstrap, args)).rejects.toThrow("already initialized");
});
test("instance administrator cannot deactivate even with a fresh session and workspace successor", async () => {
  const f = await workspaceJourney();
  await f.t.run((ctx) => ctx.db.patch(f.userId, { email: "operator@example.test", emailVerificationTime: Date.now() }));
  await f.t.mutation(internal.identity.instance.index.bootstrap, {
    userId: f.userId,
    expectedEmail: "operator@example.test",
  });
  const sessionId = await f.t.run((ctx) =>
    ctx.db.insert("authSessions", { userId: f.userId, expirationTime: Date.now() + 60000 })
  );
  const actor = f.t.withIdentity({ subject: `${f.userId}|${sessionId}` });
  await expect(actor.mutation(internal.identity.deactivation.index.commit, { sessionId })).rejects.toThrow(
    "Instance administrators"
  );
  expect(await actor.query(api.identity.session.status, {})).toMatchObject({ valid: true });
  expect(await f.t.run((ctx) => ctx.db.query("accountRestrictions").collect())).toEqual([]);
});
test("restricted accounts cannot bootstrap authority and read-only membership is actor-private", async () => {
  const f = await workspaceJourney();
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.userId, { email: "operator@example.test", emailVerificationTime: Date.now() });
    await ctx.db.insert("accountRestrictions", { userId: f.userId, deactivatedAt: Date.now() });
  });
  await expect(
    f.t.mutation(internal.identity.instance.index.bootstrap, {
      userId: f.userId,
      expectedEmail: "operator@example.test",
    })
  ).rejects.toThrow("deactivated");
  await expect(f.owner.query(api.identity.instance.index.me, {})).rejects.toThrow("expired");
  expect(await f.t.run((ctx) => ctx.db.query("instanceAuthority").collect())).toEqual([]);
});

test("uninitialized authority blocks direct deactivation without changing memberships or sessions", async () => {
  const f = await workspaceJourney();
  const sessionId = await f.t.run((ctx) =>
    ctx.db.insert("authSessions", { userId: f.userId, expirationTime: Date.now() + 60000 })
  );
  const actor = f.t.withIdentity({ subject: `${f.userId}|${sessionId}` });
  await expect(actor.mutation(internal.identity.deactivation.index.commit, { sessionId })).rejects.toThrow(
    "must be initialized"
  );
  expect(await actor.query(api.identity.session.status, {})).toMatchObject({ valid: true });
  await f.t.run(async (ctx) => {
    expect(await ctx.db.query("accountRestrictions").collect()).toEqual([]);
    expect((await ctx.db.query("workspaceMembers").collect()).every((row) => row.active)).toBe(true);
  });
});
