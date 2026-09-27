import { signedIn } from "../../../test-support/session";
import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";

const fields = { displayName: "Delivery owner", firstName: "Delivery", lastName: "Owner", timezone: "Asia/Jakarta" };
test("profile edits update the public name atomically while personal fields remain owner-only", async () => {
  const { t, owner, userId } = await workspaceJourney();
  await owner.mutation(api.identity.profile.save, { ...fields, expectedRevision: 0 });
  expect(await owner.query(api.identity.profile.get, {})).toMatchObject({ ...fields, revision: 1 });
  expect(await owner.query(api.identity.index.current, {})).toEqual({
    id: userId,
    name: fields.displayName,
    email: null,
  });
  const otherId = await t.run((ctx) => ctx.db.insert("users", { name: "Other" }));
  const other = await signedIn(t, otherId);
  expect(await other.query(api.identity.profile.get, {})).toMatchObject({
    displayName: "Other",
    firstName: "",
    revision: 0,
  });
  await expect(t.query(api.identity.profile.get, {})).rejects.toThrow("Sign in");
  await expect(t.mutation(api.identity.profile.save, { ...fields, expectedRevision: 0 })).rejects.toThrow("Sign in");
});
test("stale profile edits and invalid fields cannot partially change the public name", async () => {
  const { owner } = await workspaceJourney();
  await expect(
    owner.mutation(api.identity.profile.save, { ...fields, timezone: "bad/timezone", expectedRevision: 0 })
  ).rejects.toThrow("timezone");
  await expect(
    owner.mutation(api.identity.profile.save, { ...fields, firstName: "https://example.com", expectedRevision: 0 })
  ).rejects.toThrow("URL");
  expect(await owner.query(api.identity.index.current, {})).toMatchObject({ name: "Owner" });
  await owner.mutation(api.identity.profile.save, { ...fields, expectedRevision: 0 });
  await expect(
    owner.mutation(api.identity.profile.save, { ...fields, displayName: "Stale", expectedRevision: 0 })
  ).rejects.toThrow("changed");
  expect(await owner.query(api.identity.index.current, {})).toMatchObject({ name: fields.displayName });
});
