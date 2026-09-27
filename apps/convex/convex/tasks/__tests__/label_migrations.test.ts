import { expect, test } from "vitest";
import { api, internal } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
test("backfill label metadata without changing existing taxonomy and rescan idempotently", async () => {
  const f = await workspaceJourney();
  const projectId = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Labels",
    identifier: "LBL",
  });
  const id = await f.t.run((ctx) =>
    ctx.db.insert("taskLabels", {
      workspaceId: f.workspaceId,
      projectId,
      name: "Existing",
      description: "Preserve",
      color: "blue",
      sortOrder: 42,
    })
  );
  expect((await f.t.mutation(internal.tasks.label_migrations.metadata, { cursor: null })).changed).toBe(1);
  expect(await f.t.run((ctx) => ctx.db.get(id))).toMatchObject({
    name: "Existing",
    description: "Preserve",
    color: "blue",
    sortOrder: 42,
    parentId: null,
    revision: 0,
    retiring: false,
  });
  expect((await f.t.mutation(internal.tasks.label_migrations.metadata, { cursor: null })).changed).toBe(0);
});
