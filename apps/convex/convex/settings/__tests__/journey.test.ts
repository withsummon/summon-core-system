import { signedIn } from "../../../test-support/session";
import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";

const data = {
  slug: "workspace",
  name: "Renamed workspace",
  organizationSize: "11-50",
  timezone: "Asia/Jakarta",
  industry: "Technology",
  description: "Our delivery workspace",
  currency: "IDR",
  workweek: ["mon", "tue", "wed", "thu", "fri"] as const,
};

test("given a new workspace, reads return defaults without materializing settings", async () => {
  const { t, owner, workspaceId } = await workspaceJourney();
  expect(await owner.query(api.settings.index.metadata, { workspaceId })).toMatchObject({
    name: "Workspace",
    timezone: "UTC",
    currency: "IDR",
    workweek: [],
  });
  expect(await t.run((ctx) => ctx.db.query("workspaceSettings").collect())).toHaveLength(0);
});

test("given an administrator, saves update workspace name and settings atomically", async () => {
  const { owner, workspaceId } = await workspaceJourney();
  await owner.mutation(api.settings.index.update, {
    workspaceId,
    expectedRevision: 0,
    ...data,
    workweek: [...data.workweek],
  });
  expect(await owner.query(api.settings.index.metadata, { workspaceId })).toMatchObject(data);
  expect(await owner.query(api.workspaces.index.list, {})).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: data.name })])
  );
  await expect(
    owner.mutation(api.settings.index.update, {
      workspaceId,
      expectedRevision: 1,
      ...data,
      name: "Should not commit",
      timezone: "invalid",
      workweek: [...data.workweek],
    })
  ).rejects.toThrow("timezone");
  expect(await owner.query(api.settings.index.metadata, { workspaceId })).toMatchObject({ name: data.name });
});

test("given a member or guest, settings remain readable but only administrators write", async () => {
  const { t, owner, workspaceId } = await workspaceJourney();
  const userId = await t.run((ctx) => ctx.db.insert("users", { name: "Reader" }));
  const reader = await signedIn(t, userId);
  await expect(reader.query(api.settings.index.metadata, { workspaceId })).rejects.toThrow();
  await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "member" });
  expect(await reader.query(api.settings.index.metadata, { workspaceId })).toMatchObject({ currency: "IDR" });
  await expect(
    reader.mutation(api.settings.index.update, {
      workspaceId,
      expectedRevision: 0,
      ...data,
      workweek: [...data.workweek],
    })
  ).rejects.toThrow("administrators");
  await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "guest" });
  await expect(
    reader.mutation(api.settings.index.update, {
      workspaceId,
      expectedRevision: 0,
      ...data,
      workweek: [...data.workweek],
    })
  ).rejects.toThrow();
  await owner.mutation(api.workspaces.index.revokeMember, { workspaceId, userId });
  await expect(reader.query(api.settings.index.metadata, { workspaceId })).rejects.toThrow();
});

test("given invalid workweek or currency, no settings or workspace changes commit", async () => {
  const { t, owner, workspaceId } = await workspaceJourney();
  await expect(
    owner.mutation(api.settings.index.update, { workspaceId, expectedRevision: 0, ...data, workweek: ["mon", "mon"] })
  ).rejects.toThrow("unique");
  await expect(
    owner.mutation(api.settings.index.update, {
      workspaceId,
      expectedRevision: 0,
      ...data,
      currency: "idr",
      workweek: [],
    })
  ).rejects.toThrow("currency");
  expect(await t.run((ctx) => ctx.db.query("workspaceSettings").collect())).toHaveLength(0);
  expect(await owner.query(api.settings.index.metadata, { workspaceId })).toMatchObject({ name: "Workspace" });
});
