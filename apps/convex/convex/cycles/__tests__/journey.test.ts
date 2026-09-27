import { expect, test, vi } from "vitest";
import { api, internal } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { cyclePhase, validateCycleDates } from "../dates";
const draft = { name: "Delivery", description: "", startDate: null, endDate: null };
async function fixture() {
  const base = await workspaceJourney();
  const cycleId = await base.owner.mutation(api.cycles.index.create, { projectId: base.projectId, ...draft });
  const taskId = await base.owner.mutation(api.tasks.index.create, { projectId: base.projectId, title: "Ship" });
  return { ...base, cycleId, taskId };
}
test("project timezone initializes from workspace, becomes independent and old rows require bounded backfill", async () => {
  const f = await workspaceJourney();
  await f.t.run((ctx) =>
    ctx.db.insert("workspaceSettings", {
      workspaceId: f.workspaceId,
      timezone: "Asia/Jakarta",
      organizationSize: null,
      industry: "",
      description: "",
      currency: "IDR",
      workweek: [],
    })
  );
  const projectId = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Jakarta",
    identifier: "JKT",
  });
  expect((await f.owner.query(api.projects.timezone.get, { projectId })).timezone).toBe("Asia/Jakarta");
  await f.owner.mutation(api.projects.timezone.save, {
    projectId,
    expectedTimezone: "Asia/Jakarta",
    timezone: "America/New_York",
  });
  await expect(
    f.owner.mutation(api.projects.timezone.save, { projectId, expectedTimezone: "Asia/Jakarta", timezone: "UTC" })
  ).rejects.toThrow("changed");
  await expect(
    f.owner.mutation(api.projects.timezone.save, {
      projectId,
      expectedTimezone: "America/New_York",
      timezone: "No/SuchZone",
    })
  ).rejects.toThrow("IANA");
  await f.t.run((ctx) => ctx.db.patch(f.projectId, { timezone: undefined }));
  await expect(f.owner.mutation(api.cycles.index.create, { projectId: f.projectId, ...draft })).rejects.toThrow(
    "migration"
  );
  const backfill = await f.t.mutation(internal.projects.timezone.backfill, { cursor: null });
  expect(backfill.changed).toBe(1);
  expect(backfill.isDone).toBe(true);
  expect((await f.owner.query(api.projects.timezone.get, { projectId: f.projectId })).timezone).toBe("Asia/Jakarta");
  expect((await f.owner.query(api.projects.timezone.get, { projectId })).timezone).toBe("America/New_York");
});
test("calendar validation and stored-zone phase handle invalid dates and timezone day boundaries", () => {
  for (const pair of [
    [null, "2026-01-01"],
    ["2026-02-30", "2026-03-01"],
    ["2026-04-02", "2026-04-01"],
  ] as const)
    expect(() => validateCycleDates(pair[0], pair[1])).toThrow();
  expect(() => validateCycleDates("2024-02-29", "2024-02-29")).not.toThrow();
  const cycle = { startDate: "2026-09-27", endDate: "2026-09-27", timezone: "Asia/Jakarta" };
  expect(cyclePhase(cycle, Date.parse("2026-09-27T16:59:59Z"))).toBe("current");
  expect(cyclePhase(cycle, Date.parse("2026-09-27T17:00:00Z"))).toBe("completed");
  expect(cyclePhase({ ...cycle, timezone: "America/New_York" }, Date.parse("2026-09-27T17:00:00Z"))).toBe("current");
});
test("overlap is rejected inside write, drafts allowed, frozen-clock CAS prevents stale update", async () => {
  const f = await workspaceJourney();
  const cycleId = await f.owner.mutation(api.cycles.index.create, {
    projectId: f.projectId,
    ...draft,
    startDate: "2090-01-01",
    endDate: "2090-01-07",
  });
  await expect(
    f.owner.mutation(api.cycles.index.create, {
      projectId: f.projectId,
      ...draft,
      startDate: "2090-01-07",
      endDate: "2090-01-08",
    })
  ).rejects.toThrow("overlap");
  await f.owner.mutation(api.cycles.index.create, { projectId: f.projectId, ...draft });
  const cycle = await f.owner.query(api.cycles.index.get, { now: Date.now(), cycleId });
  const clock = vi.spyOn(Date, "now").mockReturnValue(cycle.updatedAt);
  try {
    await f.owner.mutation(api.cycles.index.update, {
      cycleId,
      expectedUpdatedAt: cycle.updatedAt,
      ...draft,
      name: "Renamed",
      startDate: cycle.startDate,
      endDate: cycle.endDate,
    });
    await expect(
      f.owner.mutation(api.cycles.index.update, { cycleId, expectedUpdatedAt: cycle.updatedAt, ...draft })
    ).rejects.toThrow("changed");
    expect((await f.owner.query(api.cycles.index.get, { now: Date.now(), cycleId })).updatedAt).toBe(
      cycle.updatedAt + 1
    );
  } finally {
    clock.mockRestore();
  }
});
test("assignment moves one canonical membership, rejects cross-project/stale writes and preserves task on reversible deletion", async () => {
  const f = await fixture();
  const task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  const cycle = await f.owner.query(api.cycles.index.get, { now: Date.now(), cycleId: f.cycleId });
  const args = {
    cycleId: f.cycleId,
    taskId: f.taskId,
    expectedTaskUpdatedAt: task.updatedAt,
    expectedCycleUpdatedAt: cycle.updatedAt,
  };
  await f.owner.mutation(api.cycles.tasks.assign, args);
  await f.owner.mutation(api.cycles.tasks.assign, args);
  const destinationId = await f.owner.mutation(api.cycles.index.create, {
    projectId: f.projectId,
    ...draft,
    name: "Next",
  });
  const destination = await f.owner.query(api.cycles.index.get, { now: Date.now(), cycleId: destinationId });
  await expect(
    f.owner.mutation(api.cycles.tasks.assign, {
      ...args,
      cycleId: destinationId,
      expectedCycleUpdatedAt: destination.updatedAt,
    })
  ).rejects.toThrow("changed");
  const currentTask = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.cycles.tasks.assign, {
    ...args,
    cycleId: destinationId,
    expectedCycleUpdatedAt: destination.updatedAt,
    expectedTaskUpdatedAt: currentTask.updatedAt,
  });
  expect(await f.t.run((ctx) => ctx.db.query("cycleTasks").collect())).toHaveLength(1);
  expect((await f.owner.query(api.cycles.tasks.current, { taskId: f.taskId }))?._id).toBe(destinationId);
  await f.owner.mutation(api.cycles.index.lifecycle, {
    cycleId: destinationId,
    expectedUpdatedAt: destination.updatedAt,
    operation: "delete",
  });
  expect(await f.owner.query(api.cycles.tasks.current, { taskId: f.taskId })).toBeNull();
  expect((await f.owner.query(api.tasks.index.get, { taskId: f.taskId })).title).toBe("Ship");
  const deleted = await f.owner.query(api.cycles.index.get, { now: Date.now(), cycleId: destinationId });
  await f.owner.mutation(api.cycles.index.lifecycle, {
    cycleId: destinationId,
    expectedUpdatedAt: deleted.updatedAt,
    operation: "restore",
  });
  expect((await f.owner.query(api.cycles.tasks.current, { taskId: f.taskId }))?._id).toBe(destinationId);
  const otherProject = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Other",
    identifier: "OTH",
  });
  const foreignTask = await f.owner.mutation(api.tasks.index.create, { projectId: otherProject, title: "Other task" });
  const restored = await f.owner.query(api.cycles.index.get, { now: Date.now(), cycleId: destinationId });
  await expect(
    f.owner.mutation(api.cycles.tasks.assign, {
      cycleId: destinationId,
      taskId: foreignTask,
      expectedTaskUpdatedAt: 0,
      expectedCycleUpdatedAt: restored.updatedAt,
    })
  ).rejects.toThrow("another project");
});
test("completed/archive writes reject, guests read only and revoked members cannot access", async () => {
  const f = await fixture();
  const endedId = await f.owner.mutation(api.cycles.index.create, {
    projectId: f.projectId,
    ...draft,
    startDate: "2000-01-01",
    endDate: "2000-01-02",
  });
  const ended = await f.owner.query(api.cycles.index.get, { now: Date.now(), cycleId: endedId });
  await expect(
    f.owner.mutation(api.cycles.index.update, { cycleId: endedId, expectedUpdatedAt: ended.updatedAt, ...draft })
  ).rejects.toThrow("Completed");
  await f.owner.mutation(api.cycles.index.lifecycle, {
    cycleId: endedId,
    expectedUpdatedAt: ended.updatedAt,
    operation: "archive",
  });
  const readerId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Guest" }));
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: readerId,
    role: "member",
  });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId: readerId, role: "guest" });
  const guest = f.t.withIdentity({ subject: readerId });
  expect((await guest.query(api.cycles.index.get, { now: Date.now(), cycleId: f.cycleId })).canWrite).toBe(false);
  await expect(guest.mutation(api.cycles.index.create, { projectId: f.projectId, ...draft })).rejects.toThrow("access");
  await f.owner.mutation(api.projects.index.revokeMember, { projectId: f.projectId, userId: readerId });
  await expect(guest.query(api.cycles.index.get, { now: Date.now(), cycleId: f.cycleId })).rejects.toThrow("access");
});
test("project civil schedule remains nonoverlapping across timezone changes, while each cycle keeps its display zone", async () => {
  const f = await workspaceJourney();
  const cycleId = await f.owner.mutation(api.cycles.index.create, {
    projectId: f.projectId,
    ...draft,
    startDate: "2090-01-01",
    endDate: "2090-01-07",
  });
  await f.owner.mutation(api.projects.timezone.save, {
    projectId: f.projectId,
    expectedTimezone: "UTC",
    timezone: "Pacific/Auckland",
  });
  const nextId = await f.owner.mutation(api.cycles.index.create, {
    projectId: f.projectId,
    ...draft,
    startDate: "2090-01-08",
    endDate: "2090-01-10",
  });
  expect((await f.owner.query(api.cycles.index.get, { cycleId, now: Date.now() })).timezone).toBe("UTC");
  expect((await f.owner.query(api.cycles.index.get, { cycleId: nextId, now: Date.now() })).timezone).toBe(
    "Pacific/Auckland"
  );
  await expect(
    f.owner.mutation(api.cycles.index.create, {
      projectId: f.projectId,
      ...draft,
      startDate: "2090-01-07",
      endDate: "2090-01-08",
    })
  ).rejects.toThrow("overlap");
  expect(
    cyclePhase(
      { startDate: "2026-03-08", endDate: "2026-03-08", timezone: "America/New_York" },
      Date.parse("2026-03-09T03:59:59Z")
    )
  ).toBe("current");
  expect(
    cyclePhase(
      { startDate: "2026-03-08", endDate: "2026-03-08", timezone: "America/New_York" },
      Date.parse("2026-03-09T04:00:00Z")
    )
  ).toBe("completed");
});
test("restoring deleted schedule checks overlap and cannot resurrect a task moved away", async () => {
  const f = await fixture();
  const task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  const original = await f.owner.query(api.cycles.index.get, { cycleId: f.cycleId, now: Date.now() });
  await f.owner.mutation(api.cycles.tasks.assign, {
    cycleId: f.cycleId,
    taskId: f.taskId,
    expectedTaskUpdatedAt: task.updatedAt,
    expectedCycleUpdatedAt: original.updatedAt,
  });
  await f.owner.mutation(api.cycles.index.lifecycle, {
    cycleId: f.cycleId,
    expectedUpdatedAt: original.updatedAt,
    operation: "delete",
  });
  const nextId = await f.owner.mutation(api.cycles.index.create, { projectId: f.projectId, ...draft });
  const next = await f.owner.query(api.cycles.index.get, { cycleId: nextId, now: Date.now() });
  const latestTask = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.cycles.tasks.assign, {
    cycleId: nextId,
    taskId: f.taskId,
    expectedTaskUpdatedAt: latestTask.updatedAt,
    expectedCycleUpdatedAt: next.updatedAt,
  });
  const deleted = await f.owner.query(api.cycles.index.get, { cycleId: f.cycleId, now: Date.now() });
  await f.owner.mutation(api.cycles.index.lifecycle, {
    cycleId: f.cycleId,
    expectedUpdatedAt: deleted.updatedAt,
    operation: "restore",
  });
  expect((await f.owner.query(api.cycles.tasks.current, { taskId: f.taskId }))?._id).toBe(nextId);
  const datedId = await f.owner.mutation(api.cycles.index.create, {
    projectId: f.projectId,
    ...draft,
    startDate: "2091-01-01",
    endDate: "2091-01-02",
  });
  const dated = await f.owner.query(api.cycles.index.get, { cycleId: datedId, now: Date.now() });
  await f.owner.mutation(api.cycles.index.lifecycle, {
    cycleId: datedId,
    expectedUpdatedAt: dated.updatedAt,
    operation: "delete",
  });
  await f.owner.mutation(api.cycles.index.create, {
    projectId: f.projectId,
    ...draft,
    startDate: "2091-01-01",
    endDate: "2091-01-02",
  });
  const removed = await f.owner.query(api.cycles.index.get, { cycleId: datedId, now: Date.now() });
  await expect(
    f.owner.mutation(api.cycles.index.lifecycle, {
      cycleId: datedId,
      expectedUpdatedAt: removed.updatedAt,
      operation: "restore",
    })
  ).rejects.toThrow("overlap");
  expect((await f.owner.query(api.cycles.index.get, { cycleId: datedId, now: Date.now() })).deleted).toBe(true);
});
test("completed source membership is immutable, assignment has one task event and task revisions advance", async () => {
  const f = await fixture();
  const task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  const cycle = await f.owner.query(api.cycles.index.get, { cycleId: f.cycleId, now: Date.now() });
  const args = {
    cycleId: f.cycleId,
    taskId: f.taskId,
    expectedTaskUpdatedAt: task.updatedAt,
    expectedCycleUpdatedAt: cycle.updatedAt,
  };
  await f.owner.mutation(api.cycles.tasks.assign, args);
  await f.owner.mutation(api.cycles.tasks.assign, args);
  const updated = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  expect(updated.updatedAt).toBeGreaterThan(task.updatedAt);
  expect(
    (
      await f.t.run((ctx) =>
        ctx.db
          .query("taskEvents")
          .withIndex("by_task", (q) => q.eq("taskId", f.taskId))
          .collect()
      )
    ).map((event) => event.kind)
  ).toEqual(["created", "updated"]);
  await f.t.run((ctx) => ctx.db.patch(f.cycleId, { startDate: "2000-01-01", endDate: "2000-01-02" }));
  await expect(
    f.owner.mutation(api.cycles.tasks.remove, { ...args, expectedTaskUpdatedAt: updated.updatedAt })
  ).rejects.toThrow("Completed");
  const otherId = await f.owner.mutation(api.cycles.index.create, { projectId: f.projectId, ...draft });
  const other = await f.owner.query(api.cycles.index.get, { cycleId: otherId, now: Date.now() });
  await expect(
    f.owner.mutation(api.cycles.tasks.assign, {
      ...args,
      cycleId: otherId,
      expectedCycleUpdatedAt: other.updatedAt,
      expectedTaskUpdatedAt: updated.updatedAt,
    })
  ).rejects.toThrow("Completed");
});
test("same-revision concurrent lifecycle calls cannot both alter state, deletion is creator/admin only", async () => {
  const f = await fixture();
  const memberId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Member" }));
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: memberId,
    role: "member",
  });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId: memberId, role: "member" });
  const member = f.t.withIdentity({ subject: memberId });
  const cycle = await f.owner.query(api.cycles.index.get, { cycleId: f.cycleId, now: Date.now() });
  await expect(
    member.mutation(api.cycles.index.lifecycle, {
      cycleId: f.cycleId,
      expectedUpdatedAt: cycle.updatedAt,
      operation: "delete",
    })
  ).rejects.toThrow("creator");
  const calls = await Promise.allSettled(
    [1, 2].map(() =>
      f.owner.mutation(api.cycles.index.lifecycle, {
        cycleId: f.cycleId,
        expectedUpdatedAt: cycle.updatedAt,
        operation: "delete",
      })
    )
  );
  expect(calls.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const deleted = await f.owner.query(api.cycles.index.get, { cycleId: f.cycleId, now: Date.now() });
  await f.owner.mutation(api.cycles.index.lifecycle, {
    cycleId: f.cycleId,
    expectedUpdatedAt: deleted.updatedAt,
    operation: "delete",
  });
  expect((await f.owner.query(api.cycles.index.get, { cycleId: f.cycleId, now: Date.now() })).updatedAt).toBe(
    deleted.updatedAt
  );
});
test("read clocks and page budgets validate before Intl; bounded backfill preserves cursor", async () => {
  const f = await fixture();
  await expect(f.owner.query(api.cycles.index.get, { cycleId: f.cycleId, now: 8_640_000_000_000_001 })).rejects.toThrow(
    "Invalid cycle clock"
  );
  const page = await f.owner.query(api.cycles.index.list, {
    projectId: f.projectId,
    deleted: false,
    paginationOpts: { numItems: 1, cursor: null },
  });
  expect(page.page[0]).not.toHaveProperty("phase");
  expect(cyclePhase(page.page[0], Date.now())).toBe("draft");
  await expect(
    f.owner.query(api.cycles.index.list, {
      projectId: f.projectId,
      deleted: false,
      paginationOpts: { numItems: 101, cursor: null },
    })
  ).rejects.toThrow("100");
  await f.t.run(async (ctx) => {
    await Promise.all(
      Array.from({ length: 51 }, (_, index) =>
        ctx.db.insert("projects", {
          workspaceId: f.workspaceId,
          name: `Old ${index}`,
          identifier: `OLD${index}`,
          nextSequence: 1,
          archived: false,
        })
      )
    );
  });
  const first = await f.t.mutation(internal.projects.timezone.backfill, { cursor: null });
  expect(first.isDone).toBe(false);
  const second = await f.t.mutation(internal.projects.timezone.backfill, { cursor: first.continueCursor });
  expect(second.isDone).toBe(true);
  expect(first.changed + second.changed).toBe(51);
});
test("cycle and task membership caps reject the next record without silently truncating", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    await Promise.all(
      Array.from({ length: 199 }, (_, index) =>
        ctx.db.insert("cycles", {
          ...draft,
          name: `Cycle ${index}`,
          workspaceId: f.workspaceId,
          projectId: f.projectId,
          timezone: "UTC",
          createdBy: f.userId,
          updatedAt: Date.now(),
          archived: false,
          deleted: false,
        })
      )
    );
    await Promise.all(
      Array.from({ length: 100 }, async (_, index) => {
        const taskId = await ctx.db.insert("tasks", {
          workspaceId: f.workspaceId,
          projectId: f.projectId,
          title: `Capacity ${index}`,
          description: "",
          status: "todo",
          sequence: index + 2,
          createdBy: f.userId,
          updatedAt: Date.now(),
          priority: "none",
          assigneeIds: [],
          labelIds: [],
          startDate: null,
          targetDate: null,
          stateId: null,
          completedAt: null,
        });
        await ctx.db.insert("cycleTasks", { taskId, cycleId: f.cycleId });
      })
    );
  });
  await expect(f.owner.mutation(api.cycles.index.create, { projectId: f.projectId, ...draft })).rejects.toThrow(
    "200 cycle limit"
  );
  const cycle = await f.owner.query(api.cycles.index.get, { cycleId: f.cycleId, now: Date.now() });
  const task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await expect(
    f.owner.mutation(api.cycles.tasks.assign, {
      cycleId: f.cycleId,
      taskId: f.taskId,
      expectedCycleUpdatedAt: cycle.updatedAt,
      expectedTaskUpdatedAt: task.updatedAt,
    })
  ).rejects.toThrow("100 task limit");
  expect(await f.owner.query(api.cycles.tasks.current, { taskId: f.taskId })).toBeNull();
});
