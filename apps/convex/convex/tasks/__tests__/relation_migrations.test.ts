import { expect, test } from "vitest";
import { api, internal } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
test("workspace ownership backfill preserves edge identity and task revisions, then converges", async () => {
  const f = await workspaceJourney();
  const a = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "A" });
  const b = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "B" });
  const edge = await f.t.run((ctx) =>
    ctx.db.insert("taskRelations", { projectId: f.projectId, fromId: a, toId: b, kind: "blocks" })
  );
  const before = await f.owner.query(api.tasks.index.get, { taskId: a });
  expect(await f.t.mutation(internal.tasks.relation_migrations.workspace, { cursor: null })).toMatchObject({
    processed: 1,
    changed: 1,
    isDone: true,
  });
  expect(await f.t.run((ctx) => ctx.db.get(edge))).toMatchObject({ workspaceId: f.workspaceId, fromId: a, toId: b });
  expect((await f.owner.query(api.tasks.index.get, { taskId: a })).updatedAt).toBe(before.updatedAt);
  expect(await f.t.mutation(internal.tasks.relation_migrations.workspace, { cursor: null })).toMatchObject({
    changed: 0,
    isDone: true,
  });
});
test("backfill rejects foreign-workspace edges rather than blessing inconsistent ownership", async () => {
  const f = await workspaceJourney();
  const ws = await f.owner.mutation(api.workspaces.index.create, { slug: "other", name: "Other" });
  const project = await f.owner.mutation(api.projects.index.create, {
    workspaceId: ws,
    identifier: "OTH",
    name: "Other",
  });
  const a = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "A" });
  const b = await f.owner.mutation(api.tasks.index.create, { projectId: project, title: "B" });
  const edge = await f.t.run((ctx) =>
    ctx.db.insert("taskRelations", { projectId: f.projectId, fromId: a, toId: b, kind: "blocks" })
  );
  await expect(f.t.mutation(internal.tasks.relation_migrations.workspace, { cursor: null })).rejects.toThrow(
    "workspace"
  );
  expect((await f.t.run((ctx) => ctx.db.get(edge)))?.workspaceId).toBeUndefined();
});
