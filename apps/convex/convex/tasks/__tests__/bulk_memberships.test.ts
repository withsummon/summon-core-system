import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
async function fixture() {
  const f = await workspaceJourney();
  const ids = await Promise.all(
    ["A", "B"].map((title) => f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title }))
  );
  const cycleId = await f.owner.mutation(api.cycles.index.create, {
    projectId: f.projectId,
    name: "Cycle",
    description: "",
    startDate: null,
    endDate: null,
  });
  const moduleId = await f.owner.mutation(api.modules.index.create, {
    projectId: f.projectId,
    name: "Module",
    descriptionHtml: "",
    startDate: null,
    targetDate: null,
    status: "backlog",
    leadId: null,
  });
  const tasks = () =>
    Promise.all(
      ids.map(async (taskId) => ({
        taskId,
        expectedUpdatedAt: (await f.owner.query(api.tasks.index.get, { taskId })).updatedAt,
      }))
    );
  return { ...f, ids, cycleId, moduleId, tasks };
}
test("bulk cycle assignment and removal preserve stable tasks; module assignment is additive", async () => {
  const f = await fixture();
  const cycle = await f.t.run((ctx) => ctx.db.get(f.cycleId));
  await f.owner.mutation(api.tasks.bulk_memberships.change, {
    projectId: f.projectId,
    tasks: await f.tasks(),
    target: { kind: "cycle", id: f.cycleId, expectedUpdatedAt: cycle!.updatedAt },
    assigned: true,
  });
  expect(await f.t.run((ctx) => ctx.db.query("cycleTasks").collect())).toHaveLength(2);
  const module = await f.t.run((ctx) => ctx.db.get(f.moduleId));
  await f.owner.mutation(api.tasks.bulk_memberships.change, {
    projectId: f.projectId,
    tasks: await f.tasks(),
    target: { kind: "module", id: f.moduleId, expectedUpdatedAt: module!.updatedAt },
    assigned: true,
  });
  expect(await f.t.run((ctx) => ctx.db.query("moduleTasks").collect())).toHaveLength(2);
  expect(await f.t.run((ctx) => ctx.db.query("cycleTasks").collect())).toHaveLength(2);
  await f.owner.mutation(api.tasks.bulk_memberships.change, {
    projectId: f.projectId,
    tasks: await f.tasks(),
    target: { kind: "cycle", id: f.cycleId, expectedUpdatedAt: cycle!.updatedAt },
    assigned: false,
  });
  expect(await f.t.run((ctx) => ctx.db.query("cycleTasks").collect())).toHaveLength(0);
  expect(await f.owner.query(api.tasks.index.get, { taskId: f.ids[0] })).toMatchObject({ title: "A" });
});
test("stale batch and archived target reject all memberships and events", async () => {
  const f = await fixture();
  const tasks = await f.tasks();
  const module = await f.t.run((ctx) => ctx.db.get(f.moduleId));
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.ids[1], status: "done" });
  const before = await f.t.run((ctx) => ctx.db.query("taskEvents").collect());
  await expect(
    f.owner.mutation(api.tasks.bulk_memberships.change, {
      projectId: f.projectId,
      tasks,
      target: { kind: "module", id: f.moduleId, expectedUpdatedAt: module!.updatedAt },
      assigned: true,
    })
  ).rejects.toThrow("changed");
  expect(await f.t.run((ctx) => ctx.db.query("moduleTasks").collect())).toEqual([]);
  expect(await f.t.run((ctx) => ctx.db.query("taskEvents").collect())).toEqual(before);
  await f.t.run((ctx) => ctx.db.patch(f.moduleId, { archived: true }));
  await expect(
    f.owner.mutation(api.tasks.bulk_memberships.change, {
      projectId: f.projectId,
      tasks: await f.tasks(),
      target: { kind: "module", id: f.moduleId, expectedUpdatedAt: module!.updatedAt },
      assigned: true,
    })
  ).rejects.toThrow();
  expect(await f.t.run((ctx) => ctx.db.query("moduleTasks").collect())).toEqual([]);
});
test("cycle capacity failure on a later item rolls back earlier membership and task revision", async () => {
  const f = await fixture();
  const cycle = await f.t.run((ctx) => ctx.db.get(f.cycleId));
  await Promise.all(
    Array.from({ length: 99 }, async (_, i) => {
      const taskId = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: `Filler ${i}` });
      await f.t.run((ctx) => ctx.db.insert("cycleTasks", { cycleId: f.cycleId, taskId }));
    })
  );
  const tasks = await f.tasks();
  await expect(
    f.owner.mutation(api.tasks.bulk_memberships.change, {
      projectId: f.projectId,
      tasks,
      target: { kind: "cycle", id: f.cycleId, expectedUpdatedAt: cycle!.updatedAt },
      assigned: true,
    })
  ).rejects.toThrow("100 task limit");
  expect(await f.t.run((ctx) => ctx.db.query("cycleTasks").collect())).toHaveLength(99);
  expect(await f.tasks()).toEqual(tasks);
});
test("bulk membership rejects foreign project target and current guest or revoked project access", async () => {
  const f = await fixture();
  const projectId = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Other",
    identifier: "OTH",
  });
  const foreign = await f.owner.mutation(api.modules.index.create, {
    projectId,
    name: "Foreign",
    descriptionHtml: "",
    startDate: null,
    targetDate: null,
    status: "backlog",
    leadId: null,
  });
  const foreignRow = await f.t.run((ctx) => ctx.db.get(foreign));
  await expect(
    f.owner.mutation(api.tasks.bulk_memberships.change, {
      projectId: f.projectId,
      tasks: await f.tasks(),
      target: { kind: "module", id: foreign, expectedUpdatedAt: foreignRow!.updatedAt },
      assigned: true,
    })
  ).rejects.toThrow("another project");
  const module = await f.t.run((ctx) => ctx.db.get(f.moduleId));
  const args = {
    projectId: f.projectId,
    tasks: await f.tasks(),
    target: { kind: "module" as const, id: f.moduleId, expectedUpdatedAt: module!.updatedAt },
    assigned: true,
  };
  const membership = await f.t.run((ctx) =>
    ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", f.projectId).eq("userId", f.userId))
      .unique()
  );
  await f.t.run((ctx) => ctx.db.patch(membership!._id, { role: "guest" }));
  await expect(f.owner.mutation(api.tasks.bulk_memberships.change, args)).rejects.toThrow();
  await f.t.run((ctx) => ctx.db.patch(membership!._id, { role: "admin", active: false }));
  await expect(f.owner.mutation(api.tasks.bulk_memberships.change, args)).rejects.toThrow();
  expect(await f.t.run((ctx) => ctx.db.query("moduleTasks").collect())).toEqual([]);
});
