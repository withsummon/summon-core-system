import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
async function fixture() {
  const f = await workspaceJourney();
  const moduleId = await f.owner.mutation(api.modules.index.create, {
    projectId: f.projectId,
    name: "Links",
    descriptionHtml: "",
    startDate: null,
    targetDate: null,
    status: "backlog",
    leadId: null,
  });
  const list = () =>
    f.owner.query(api.modules.links.list, { moduleId, paginationOpts: { cursor: null, numItems: 10 } });
  return { ...f, moduleId, list };
}
test("module links normalize URLs, reject duplicates and reject stale removals", async () => {
  const f = await fixture();
  const input = { moduleId: f.moduleId, url: "example.com/spec", title: "Spec", metadata: { kind: "reference" } };
  const linkId = await f.owner.mutation(api.modules.links.create, input);
  const first = (await f.list()).page[0];
  expect(first.url).toBe("http://example.com/spec");
  expect(first.metadata).toEqual({ kind: "reference" });
  await expect(f.owner.mutation(api.modules.links.create, input)).rejects.toThrow("already exists");
  await f.owner.mutation(api.modules.links.update, {
    ...input,
    linkId,
    expectedUpdatedAt: first.updatedAt,
    title: "Updated",
  });
  await expect(
    f.owner.mutation(api.modules.links.remove, { moduleId: f.moduleId, linkId, expectedUpdatedAt: first.updatedAt })
  ).rejects.toThrow("changed");
  const updated = (await f.list()).page[0];
  await f.owner.mutation(api.modules.links.remove, {
    moduleId: f.moduleId,
    linkId,
    expectedUpdatedAt: updated.updatedAt,
  });
  expect((await f.list()).page).toHaveLength(0);
  await f.owner.mutation(api.modules.links.create, input);
});
test("module links enforce current ACL and preserve references through module recovery", async () => {
  const f = await fixture();
  const input = { moduleId: f.moduleId, url: "https://example.com", title: null, metadata: {} };
  const linkId = await f.owner.mutation(api.modules.links.create, input);
  const strangerId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Stranger" }));
  const stranger = await signedIn(f.t, strangerId);
  await expect(
    stranger.query(api.modules.links.list, { moduleId: f.moduleId, paginationOpts: { cursor: null, numItems: 10 } })
  ).rejects.toThrow();
  await expect(stranger.mutation(api.modules.links.create, input)).rejects.toThrow();
  await f.t.run((ctx) => ctx.db.patch(f.moduleId, { status: "completed" }));
  const lifecycle = async (operation: "archive" | "delete" | "restore" | "unarchive") => {
    const module = await f.owner.query(api.modules.index.get, { moduleId: f.moduleId });
    await f.owner.mutation(api.modules.index.lifecycle, {
      moduleId: f.moduleId,
      expectedUpdatedAt: module.updatedAt,
      operation,
    });
  };
  await lifecycle("archive");
  expect((await f.list()).page).toHaveLength(1);
  await expect(f.owner.mutation(api.modules.links.create, input)).rejects.toThrow("unarchive");
  await lifecycle("delete");
  await expect(f.list()).rejects.toThrow("not found");
  await lifecycle("restore");
  await lifecycle("unarchive");
  expect((await f.list()).page[0]._id).toBe(linkId);
  await expect(f.owner.mutation(api.modules.links.create, { ...input, url: "javascript:alert(1)" })).rejects.toThrow(
    "valid HTTP"
  );
});
test("module binding rejects cross-module IDs and current guests can only read", async () => {
  const f = await fixture();
  const input = { moduleId: f.moduleId, url: "https://example.com", title: null, metadata: { preserve: true } };
  const linkId = await f.owner.mutation(api.modules.links.create, input);
  const row = (await f.list()).page[0];
  const otherId = await f.owner.mutation(api.modules.index.create, {
    projectId: f.projectId,
    name: "Other",
    descriptionHtml: "",
    startDate: null,
    targetDate: null,
    status: "backlog",
    leadId: null,
  });
  await expect(
    f.owner.mutation(api.modules.links.update, {
      ...input,
      moduleId: otherId,
      linkId,
      expectedUpdatedAt: row.updatedAt,
    })
  ).rejects.toThrow("not found");
  await expect(
    f.owner.mutation(api.modules.links.remove, { moduleId: otherId, linkId, expectedUpdatedAt: row.updatedAt })
  ).rejects.toThrow("not found");
  const userId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Guest" }));
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role: "guest" });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId, role: "guest" });
  const guest = await signedIn(f.t, userId);
  expect(
    (
      await guest.query(api.modules.links.list, {
        moduleId: f.moduleId,
        paginationOpts: { cursor: null, numItems: 10 },
      })
    ).page[0]._id
  ).toBe(linkId);
  await expect(guest.mutation(api.modules.links.create, input)).rejects.toThrow();
  await expect(
    guest.mutation(api.modules.links.remove, { moduleId: f.moduleId, linkId, expectedUpdatedAt: row.updatedAt })
  ).rejects.toThrow();
  await f.owner.mutation(api.modules.links.remove, { moduleId: f.moduleId, linkId, expectedUpdatedAt: row.updatedAt });
  expect(await f.t.run((ctx) => ctx.db.get(linkId))).toMatchObject({
    metadata: { preserve: true },
    deletedAt: expect.any(Number),
  });
  expect((await f.list()).page).toEqual([]);
});
