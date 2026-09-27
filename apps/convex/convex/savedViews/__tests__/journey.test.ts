import { signedIn } from "../../../test-support/session";
import { expect, test, vi } from "vitest";
import type { FunctionArgs } from "convex/server";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
const paginationOpts = { cursor: null, numItems: 100 };
const filters: FunctionArgs<typeof api.savedViews.index.create>["filters"] = {
  match: "all",
  statuses: [],
  stateIds: [],
  priorities: [],
  assigneeIds: [],
  labelIds: [],
  creatorIds: [],
  startDate: null,
  targetDate: null,
};
async function fixture() {
  const f = await workspaceJourney();
  const viewId = await f.owner.mutation(api.savedViews.index.create, {
    projectId: f.projectId,
    name: "My view",
    description: "Saved filter",
    filters,
  });
  return { ...f, viewId };
}
async function createPerson(f: Awaited<ReturnType<typeof fixture>>, role: "guest" | "member" | "admin") {
  const userId = await f.t.run((ctx) => ctx.db.insert("users", { name: role }));
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId, role });
  return { userId, user: await signedIn(f.t, userId) };
}
test("saved all/any predicates drive live results; empty predicates match all and lifecycle excludes inactive tasks", async () => {
  const f = await fixture();
  const first = await f.owner.mutation(api.tasks.index.create, {
    projectId: f.projectId,
    title: "Todo high",
    properties: {
      estimatePointId: null,
      priority: "high",
      assigneeIds: [],
      labelIds: [],
      stateId: null,
      startDate: "2026-09-01",
      targetDate: "2026-09-30",
    },
  });
  const second = await f.owner.mutation(api.tasks.index.create, {
    projectId: f.projectId,
    title: "Done low",
    status: "done",
    properties: {
      estimatePointId: null,
      priority: "low",
      assigneeIds: [],
      labelIds: [],
      stateId: null,
      startDate: null,
      targetDate: null,
    },
  });
  let row = await f.owner.query(api.savedViews.index.get, { viewId: f.viewId });
  const selected = { ...filters, statuses: ["todo" as const], priorities: ["low" as const] };
  await f.owner.mutation(api.savedViews.index.update, {
    viewId: f.viewId,
    expectedUpdatedAt: row.view.updatedAt,
    name: row.view.name,
    description: "",
    filters: selected,
  });
  expect((await f.owner.query(api.savedViews.results.list, { viewId: f.viewId, paginationOpts })).page).toEqual([]);
  row = await f.owner.query(api.savedViews.index.get, { viewId: f.viewId });
  await f.owner.mutation(api.savedViews.index.update, {
    viewId: f.viewId,
    expectedUpdatedAt: row.view.updatedAt,
    name: "Any",
    description: "",
    filters: { ...selected, match: "any" },
  });
  expect(
    new Set(
      (await f.owner.query(api.savedViews.results.list, { viewId: f.viewId, paginationOpts })).page.map((t) => t._id)
    )
  ).toEqual(new Set([first, second]));
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: first, status: "done" });
  expect(
    (await f.owner.query(api.savedViews.results.list, { viewId: f.viewId, paginationOpts })).page.map((t) => t._id)
  ).toEqual([second]);
  const task = await f.owner.query(api.tasks.index.get, { taskId: second });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: second,
    expectedUpdatedAt: task.updatedAt,
    operation: "archive",
  });
  expect((await f.owner.query(api.savedViews.results.list, { viewId: f.viewId, paginationOpts })).page).toEqual([]);
});
test("empty sparse pages retain continuation and newest-created order is not page-local resorting", async () => {
  const f = await fixture();
  const older = await f.owner.mutation(api.tasks.index.create, {
    projectId: f.projectId,
    title: "Match",
    status: "done",
  });
  await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Skip", status: "todo" });
  const row = await f.owner.query(api.savedViews.index.get, { viewId: f.viewId });
  await f.owner.mutation(api.savedViews.index.update, {
    viewId: f.viewId,
    expectedUpdatedAt: row.view.updatedAt,
    name: "Completed",
    description: "",
    filters: { ...filters, statuses: ["done"] },
  });
  const first = await f.owner.query(api.savedViews.results.list, {
    viewId: f.viewId,
    paginationOpts: { cursor: null, numItems: 1 },
  });
  expect(first.page).toEqual([]);
  expect(first.isDone).toBe(false);
  const second = await f.owner.query(api.savedViews.results.list, {
    viewId: f.viewId,
    paginationOpts: { cursor: first.continueCursor, numItems: 1 },
  });
  expect(second.page.map((task) => task._id)).toEqual([older]);
  await expect(
    f.owner.query(api.savedViews.results.list, { viewId: f.viewId, paginationOpts: { cursor: null, numItems: 101 } })
  ).rejects.toThrow();
});
test("owner edits only, locked views reject writes, projectadmin recovers and personal favorites hide during trash", async () => {
  vi.useFakeTimers();
  try {
    const f = await fixture();
    const member = await createPerson(f, "member");
    let row = await f.owner.query(api.savedViews.index.get, { viewId: f.viewId });
    await expect(
      member.user.mutation(api.savedViews.index.update, {
        viewId: f.viewId,
        expectedUpdatedAt: row.view.updatedAt,
        name: "Hijack",
        description: "",
        filters,
      })
    ).rejects.toThrow("owner");
    await f.owner.mutation(api.savedViews.favorites.set, { viewId: f.viewId, favorite: true });
    await f.owner.mutation(api.savedViews.favorites.set, { viewId: f.viewId, favorite: true });
    expect(
      (await f.owner.query(api.savedViews.favorites.list, { projectId: f.projectId, paginationOpts })).page
    ).toHaveLength(1);
    expect(
      (await member.user.query(api.savedViews.favorites.list, { projectId: f.projectId, paginationOpts })).page
    ).toEqual([]);
    await f.t.run((ctx) => ctx.db.patch(f.viewId, { isLocked: true }));
    await expect(
      f.owner.mutation(api.savedViews.index.update, {
        viewId: f.viewId,
        expectedUpdatedAt: row.view.updatedAt,
        name: "Locked",
        description: "",
        filters,
      })
    ).rejects.toThrow("unlocked");
    await f.owner.mutation(api.savedViews.index.lifecycle, {
      viewId: f.viewId,
      expectedUpdatedAt: row.view.updatedAt,
      deleted: true,
    });
    expect(
      (await f.owner.query(api.savedViews.favorites.list, { projectId: f.projectId, paginationOpts })).page
    ).toEqual([]);
    await expect(member.user.query(api.savedViews.index.get, { viewId: f.viewId })).rejects.toThrow("not found");
    await expect(f.owner.query(api.savedViews.results.list, { viewId: f.viewId, paginationOpts })).rejects.toThrow(
      "not found"
    );
    const admin = await createPerson(f, "admin");
    row = await admin.user.query(api.savedViews.index.get, { viewId: f.viewId });
    await admin.user.mutation(api.savedViews.index.lifecycle, {
      viewId: f.viewId,
      expectedUpdatedAt: row.view.updatedAt,
      deleted: false,
    });
    expect(
      (await f.owner.query(api.savedViews.favorites.list, { projectId: f.projectId, paginationOpts })).page
    ).toHaveLength(1);
    await expect(
      f.owner.mutation(api.savedViews.index.lifecycle, {
        viewId: f.viewId,
        expectedUpdatedAt: row.view.updatedAt,
        deleted: true,
      })
    ).rejects.toThrow("changed");
  } finally {
    vi.useRealTimers();
  }
});
test("guest view visibility and guest task visibility remain separate; revocation gates favorites and results", async () => {
  const f = await fixture();
  const guest = await createPerson(f, "guest");
  const ownView = await guest.user.mutation(api.savedViews.index.create, {
    projectId: f.projectId,
    name: "Guest view",
    description: "",
    filters,
  });
  await expect(guest.user.query(api.savedViews.index.get, { viewId: f.viewId })).rejects.toThrow("not found");
  const foreignTask = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Other task" });
  expect((await guest.user.query(api.savedViews.results.list, { viewId: ownView, paginationOpts })).page).toEqual([]);
  await expect(guest.user.mutation(api.savedViews.favorites.set, { viewId: ownView, favorite: true })).rejects.toThrow(
    "Guests"
  );
  await f.owner.mutation(api.intakes.index.configure, {
    projectId: f.projectId,
    expectedRevision: 0,
    enabled: true,
    guestViewAllFeatures: false,
  });
  const ownTask = await guest.user.mutation(api.intakes.index.submit, {
    projectId: f.projectId,
    title: "Guest task",
    html: "",
    priority: "none",
  });
  await f.owner.mutation(api.tasks.states.save, {
    projectId: f.projectId,
    data: { name: "Ready", description: "", color: "", status: "todo", sortOrder: 0, isDefault: true },
  });
  const pending = await f.owner.query(api.intakes.index.get, { taskId: ownTask });
  await f.owner.mutation(api.intakes.index.decide, {
    taskId: ownTask,
    expectedUpdatedAt: pending.intake.updatedAt,
    expectedTaskUpdatedAt: pending.task.updatedAt,
    status: "accepted",
    snoozedUntil: null,
    duplicateTo: null,
  });
  expect(
    (await guest.user.query(api.savedViews.results.list, { viewId: ownView, paginationOpts })).page.map((t) => t._id)
  ).toEqual([ownTask]);
  await f.owner.mutation(api.intakes.index.configure, {
    projectId: f.projectId,
    expectedRevision: 1,
    enabled: true,
    guestViewAllFeatures: true,
  });
  expect((await guest.user.query(api.savedViews.index.get, { viewId: f.viewId })).canEdit).toBe(false);
  expect(
    new Set(
      (await guest.user.query(api.savedViews.results.list, { viewId: ownView, paginationOpts })).page.map((t) => t._id)
    )
  ).toEqual(new Set([ownTask, foreignTask]));
  await f.owner.mutation(api.projects.index.revokeMember, { projectId: f.projectId, userId: guest.userId });
  await expect(guest.user.query(api.savedViews.results.list, { viewId: ownView, paginationOpts })).rejects.toThrow(
    "access"
  );
  await expect(
    guest.user.query(api.savedViews.favorites.list, { projectId: f.projectId, paginationOpts })
  ).rejects.toThrow("access");
});
test("date clauses are inclusive; foreign filter IDs, duplicates and invalid dates are rejected", async () => {
  const f = await fixture();
  const taskId = await f.owner.mutation(api.tasks.index.create, {
    projectId: f.projectId,
    title: "Boundary",
    properties: {
      estimatePointId: null,
      priority: "none",
      assigneeIds: [f.userId],
      labelIds: [],
      stateId: null,
      startDate: "2026-09-01",
      targetDate: "2026-09-30",
    },
  });
  const view = await f.owner.query(api.savedViews.index.get, { viewId: f.viewId });
  const base = { viewId: f.viewId, expectedUpdatedAt: view.view.updatedAt, name: "Dates", description: "" };
  await expect(
    f.owner.mutation(api.savedViews.index.update, {
      ...base,
      filters: { ...filters, startDate: { from: "2026-02-30", to: null } },
    })
  ).rejects.toThrow("valid ISO");
  await expect(
    f.owner.mutation(api.savedViews.index.update, { ...base, filters: { ...filters, statuses: ["todo", "todo"] } })
  ).rejects.toThrow("distinct");
  const foreignProject = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Other",
    identifier: "OTH",
  });
  const foreignState = await f.owner.mutation(api.tasks.states.save, {
    projectId: foreignProject,
    data: { name: "Ready", description: "", color: "", status: "todo", sortOrder: 0, isDefault: true },
  });
  await expect(
    f.owner.mutation(api.savedViews.index.update, { ...base, filters: { ...filters, stateIds: [foreignState] } })
  ).rejects.toThrow("this project");
  await f.owner.mutation(api.savedViews.index.update, {
    ...base,
    filters: {
      ...filters,
      assigneeIds: [f.userId],
      creatorIds: [f.userId],
      startDate: { from: "2026-09-01", to: "2026-09-01" },
      targetDate: { from: null, to: "2026-09-30" },
    },
  });
  expect(
    (await f.owner.query(api.savedViews.results.list, { viewId: f.viewId, paginationOpts })).page.map((t) => t._id)
  ).toEqual([taskId]);
  expect((await f.owner.query(api.savedViews.index.get, { viewId: f.viewId })).selections.users).toEqual([
    { id: f.userId, name: "Owner" },
  ]);
});
test("state and label clauses use any selected value within each field while all combines fields", async () => {
  const f = await fixture();
  const stateId = await f.owner.mutation(api.tasks.states.save, {
    projectId: f.projectId,
    data: { name: "Ready", description: "", color: "", status: "todo", sortOrder: 0, isDefault: true },
  });
  const labelId = await f.owner.mutation(api.tasks.labels.save, {
    parentId: null,
    projectId: f.projectId,
    data: { name: "Match", description: "", color: "", sortOrder: 0 },
  });
  const otherLabel = await f.owner.mutation(api.tasks.labels.save, {
    parentId: null,
    projectId: f.projectId,
    data: { name: "Other", description: "", color: "", sortOrder: 1 },
  });
  const taskId = await f.owner.mutation(api.tasks.index.create, {
    projectId: f.projectId,
    title: "Tagged",
    properties: {
      estimatePointId: null,
      stateId,
      labelIds: [labelId],
      assigneeIds: [],
      priority: "none",
      startDate: null,
      targetDate: null,
    },
  });
  await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Not tagged" });
  const row = await f.owner.query(api.savedViews.index.get, { viewId: f.viewId });
  await f.owner.mutation(api.savedViews.index.update, {
    viewId: f.viewId,
    expectedUpdatedAt: row.view.updatedAt,
    name: "States and labels",
    description: "",
    filters: { ...filters, stateIds: [stateId], labelIds: [labelId, otherLabel] },
  });
  expect(
    (await f.owner.query(api.savedViews.results.list, { viewId: f.viewId, paginationOpts })).page.map((t) => t._id)
  ).toEqual([taskId]);
  const detail = await f.owner.query(api.savedViews.index.get, { viewId: f.viewId });
  expect(detail.selections.states).toEqual([{ id: stateId, name: "Ready" }]);
  expect(detail.selections.labels).toHaveLength(2);
});
