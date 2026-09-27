import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";

test("onboarding creates organization metadata and administrator access in the same transaction", async () => {
  const { owner } = await workspaceJourney();
  const workspaceId = await owner.mutation(api.workspaces.index.create, {
    name: "Small team",
    slug: "small-team",
    organizationSize: "Just myself",
  });
  expect(await owner.query(api.settings.index.metadata, { workspaceId })).toMatchObject({
    organizationSize: "Just myself",
    revision: 0,
    canManage: true,
  });
  expect(await owner.query(api.workspaces.index.list, {})).toEqual(
    expect.arrayContaining([expect.objectContaining({ _id: workspaceId, membershipRole: "admin", deletedAt: null })])
  );
});

test("invalid organization metadata creates no workspace or membership and does not occupy its slug", async () => {
  const { owner } = await workspaceJourney();
  const before = await owner.query(api.workspaces.index.list, {});
  await expect(
    owner.mutation(api.workspaces.index.create, {
      name: "Invalid team",
      slug: "new-team",
      organizationSize: "x".repeat(21),
    })
  ).rejects.toThrow("Organization size");
  expect(await owner.query(api.workspaces.index.list, {})).toEqual(before);
  const workspaceId = await owner.mutation(api.workspaces.index.create, { name: "Valid team", slug: "new-team" });
  expect(await owner.query(api.settings.index.metadata, { workspaceId })).toMatchObject({ organizationSize: null });
});
