import { expect, test } from "vitest";
import { api, internal } from "../../../_generated/api";
import { workspaceJourney } from "../../../../test-support/fixtures";
import { signedIn } from "../../../../test-support/session";
async function fixture() {
  const f = await workspaceJourney();
  await f.t.run((ctx) => ctx.db.patch(f.userId, { email: "admin@example.test", emailVerificationTime: Date.now() }));
  await f.t.mutation(internal.identity.instance.index.bootstrap, {
    userId: f.userId,
    expectedEmail: "admin@example.test",
  });
  const userId = await f.t.run((ctx) =>
    ctx.db.insert("users", { name: "Next", email: "next@example.test", emailVerificationTime: Date.now() })
  );
  return { ...f, next: await signedIn(f.t, userId), nextId: userId };
}
test("roster and safe configuration require initialized current instance admin", async () => {
  const f = await fixture();
  await expect(
    f.next.query(api.identity.instance.roster.list, { paginationOpts: { cursor: null, numItems: 20 } })
  ).rejects.toThrow("administrator access");
  await expect(f.next.query(api.identity.instance.configuration.get, {})).rejects.toThrow("administrator access");
  const result = await f.owner.query(api.identity.instance.roster.list, {
    paginationOpts: { cursor: null, numItems: 1 },
  });
  expect(new Set(Object.keys(result.page[0]))).toEqual(
    new Set(["id", "userId", "name", "email", "role", "revision", "createdAt"])
  );
  expect(new Set(Object.keys(await f.owner.query(api.identity.instance.configuration.get, {})))).toEqual(
    new Set(["initializedAt", "passwordSignIn", "mailConfigured", "oauthProviders"])
  );
});
test("grant is idempotent, removal uses captured membership and retains final administrator", async () => {
  const f = await fixture();
  const rows = await f.owner.query(api.identity.instance.roster.list, {
    paginationOpts: { cursor: null, numItems: 20 },
  });
  await expect(
    f.owner.mutation(api.identity.instance.roster.revoke, { membershipId: rows.page[0].id, expectedRevision: 1 })
  ).rejects.toThrow("Assign another");
  const membershipId = await f.owner.mutation(api.identity.instance.roster.grant, { email: "next@example.test" });
  expect(await f.owner.mutation(api.identity.instance.roster.grant, { email: "next@example.test" })).toBe(membershipId);
  await expect(
    f.owner.mutation(api.identity.instance.roster.revoke, { membershipId, expectedRevision: 0 })
  ).rejects.toThrow("changed");
  await f.owner.mutation(api.identity.instance.roster.revoke, { membershipId: rows.page[0].id, expectedRevision: 1 });
  await expect(
    f.owner.query(api.identity.instance.roster.list, { paginationOpts: { cursor: null, numItems: 20 } })
  ).rejects.toThrow("administrator access");
  await expect(
    f.next.mutation(api.identity.instance.roster.revoke, { membershipId, expectedRevision: 1 })
  ).rejects.toThrow("Assign another");
});
test("restricted and unverified targets cannot receive instance authority", async () => {
  const f = await fixture();
  await f.t.run((ctx) => ctx.db.patch(f.nextId, { emailVerificationTime: undefined }));
  await expect(f.owner.mutation(api.identity.instance.roster.grant, { email: "next@example.test" })).rejects.toThrow(
    "verified"
  );
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.nextId, { emailVerificationTime: Date.now() });
    await ctx.db.insert("accountRestrictions", { userId: f.nextId, deactivatedAt: Date.now() });
  });
  await expect(f.owner.mutation(api.identity.instance.roster.grant, { email: "next@example.test" })).rejects.toThrow(
    "deactivated"
  );
});
