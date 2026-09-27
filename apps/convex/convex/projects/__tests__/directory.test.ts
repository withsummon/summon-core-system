import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
const paginationOpts = { cursor: null, numItems: 20 };
test("branding preserves opaque JSON and shares metadata CAS while ordinary members cannot write", async () => {
  const f = await workspaceJourney();
  const logoProps = {
    in_use: "icon",
    icon: { name: "layers", color: "#ff0000", background_color: "#ffffff" },
    extension: { future: true },
  };
  const created = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Branded",
    identifier: "BRAND",
    logoProps,
  });
  expect((await f.owner.query(api.projects.network.get, { projectId: created })).logoProps).toEqual(logoProps);
  await expect(
    f.owner.mutation(api.projects.index.create, {
      workspaceId: f.workspaceId,
      name: "Invalid",
      identifier: "INVALID",
      logoProps: { invalid: new ArrayBuffer(1) },
    })
  ).rejects.toThrow("JSON");
  expect(
    (await f.owner.query(api.projects.index.list, { workspaceId: f.workspaceId })).some(
      (row) => row.identifier === "INVALID"
    )
  ).toBe(false);
  expect((await f.owner.query(api.projects.network.get, { projectId: created })).logo).toEqual({
    in_use: "icon",
    icon: logoProps.icon,
  });
  for (const invalid of [{ in_use: "other" }, { in_use: "icon", icon: { name: 42 } }, { in_use: "emoji", emoji: [] }]) {
    await expect(
      f.owner.mutation(api.projects.branding.save, {
        projectId: f.projectId,
        expectedRevision: 0,
        logoProps: invalid,
      })
    ).rejects.toThrow();
  }
  await f.owner.mutation(api.projects.branding.save, { projectId: f.projectId, expectedRevision: 0, logoProps });
  expect((await f.owner.query(api.projects.network.get, { projectId: f.projectId })).logoProps).toEqual(logoProps);
  await expect(
    f.owner.mutation(api.projects.settings.save, {
      projectId: f.projectId,
      name: "Stale",
      description: "",
      expectedRevision: 0,
    })
  ).rejects.toThrow("changed");
  await expect(
    f.owner.mutation(api.projects.branding.save, {
      projectId: f.projectId,
      expectedRevision: 1,
      logoProps: { invalid: new ArrayBuffer(1) },
    })
  ).rejects.toThrow("JSON");
  const id = await f.t.run((ctx) => ctx.db.insert("users", { name: "Member" }));
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId: id, role: "member" });
  const member = await signedIn(f.t, id);
  await expect(
    member.mutation(api.projects.branding.save, { projectId: f.projectId, expectedRevision: 1, logoProps: {} })
  ).rejects.toThrow("administrators");
  expect((await f.owner.query(api.projects.network.get, { projectId: f.projectId })).revision).toBe(1);
});
test("discoverable roster is bounded, uses current memberships, and disappears when made private", async () => {
  const f = await workspaceJourney();
  const id = await f.t.run((ctx) => ctx.db.insert("users", { name: "Reader" }));
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId: id, role: "member" });
  const reader = await signedIn(f.t, id);
  const page = await reader.query(api.projects.directory.members, { projectId: f.projectId, paginationOpts });
  expect(page.page.map((row) => row.userId)).toEqual([f.userId]);
  expect(page.isDone).toBe(true);
  await f.owner.mutation(api.projects.network.save, { projectId: f.projectId, network: 0, expectedRevision: 0 });
  await expect(
    reader.query(api.projects.directory.members, { projectId: f.projectId, paginationOpts })
  ).rejects.toThrow("not found");
});
test("portfolio completion contributions group the same authorized active tasks without claiming partial totals", async () => {
  const f = await workspaceJourney();
  const a = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Done" });
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: a, status: "done" });
  await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Pending" });
  const scope = {
    workspaceId: f.workspaceId,
    projectId: null,
    clientId: null,
    dateFrom: null,
    dateTo: null,
    today: "2026-09-27",
  };
  const first = await f.owner.query(api.reporting.tasks.page, { scope, paginationOpts: { cursor: null, numItems: 1 } });
  expect(first.isDone).toBe(false);
  expect(first.coverage).toBe("page");
  const second = await f.owner.query(api.reporting.tasks.page, {
    scope,
    paginationOpts: { cursor: first.continueCursor, numItems: 1 },
  });
  const contributions = [first, second].map((row) => row.contribution.projects[f.projectId]);
  expect(contributions.reduce((n, row) => n + row.total, 0)).toBe(2);
  expect(contributions.reduce((n, row) => n + row.completed, 0)).toBe(1);
  const id = await f.t.run((ctx) => ctx.db.insert("users", { name: "Nonmember" }));
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId: id, role: "member" });
  const reader = await signedIn(f.t, id);
  expect((await reader.query(api.reporting.tasks.page, { scope, paginationOpts })).contribution.projects).toEqual({});
});
