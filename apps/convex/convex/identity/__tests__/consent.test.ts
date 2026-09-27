import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
test("absence grants no consent; explicit opt-in shares profile CAS and preserves unrelated fields", async () => {
  const f = await workspaceJourney();
  const before = await f.owner.query(api.identity.profile.get, {});
  expect(before.marketingEmailConsent).toBe(false);
  await f.owner.mutation(api.identity.profile.save, {
    firstName: before.firstName,
    lastName: before.lastName,
    timezone: before.timezone,
    displayName: before.displayName,
    marketingEmailConsent: true,
    expectedRevision: before.revision,
  });
  const opted = await f.owner.query(api.identity.profile.get, {});
  expect(opted).toEqual({ ...before, marketingEmailConsent: true, revision: before.revision + 1 });
  await expect(
    f.owner.mutation(api.identity.profile.save, {
      firstName: before.firstName,
      lastName: before.lastName,
      timezone: before.timezone,
      displayName: before.displayName,
      marketingEmailConsent: false,
      expectedRevision: before.revision,
    })
  ).rejects.toThrow("profile changed");
  await f.owner.mutation(api.identity.profile.save, {
    firstName: before.firstName,
    lastName: before.lastName,
    timezone: before.timezone,
    displayName: before.displayName,
    marketingEmailConsent: false,
    expectedRevision: opted.revision,
  });
  expect((await f.owner.query(api.identity.profile.get, {})).marketingEmailConsent).toBe(false);
  await expect(
    f.t.mutation(api.identity.profile.save, {
      firstName: "",
      lastName: "",
      timezone: "UTC",
      displayName: "",
      marketingEmailConsent: true,
      expectedRevision: 0,
    })
  ).rejects.toThrow("Sign in");
});

test("profile step writes names, explicit consent and only its completion flag in one revision", async () => {
  const f = await workspaceJourney();
  const before = await f.owner.query(api.identity.profile.get, {});
  const args = {
    firstName: "Ada",
    lastName: "Example",
    displayName: "Ada",
    timezone: "UTC",
    marketingEmailConsent: true,
    expectedRevision: before.revision,
  };
  expect(await f.owner.mutation(api.identity.profile.completeProfile, args)).toEqual({ revision: before.revision + 1 });
  const after = await f.owner.query(api.identity.profile.get, {});
  expect(after).toMatchObject({
    firstName: "Ada",
    marketingEmailConsent: true,
    preferences: {
      onboarding: { profileComplete: true, workspaceCreate: false, workspaceJoin: false, workspaceInvite: false },
      isOnboarded: false,
    },
  });
  await expect(
    f.owner.mutation(api.identity.profile.completeProfile, { ...args, marketingEmailConsent: false })
  ).rejects.toThrow("profile changed");
  await f.owner.mutation(api.identity.profile.save, {
    firstName: "Ada",
    lastName: "Example",
    displayName: "Ada",
    timezone: "UTC",
    expectedRevision: after.revision,
  });
  expect((await f.owner.query(api.identity.profile.get, {})).marketingEmailConsent).toBe(true);
});
