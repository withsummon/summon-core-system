import { describe, expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import type { FunctionArgs } from "convex/server";
const properties = {
  priority: "none",
  assigneeIds: [],
  labelIds: [],
  startDate: null,
  targetDate: null,
  stateId: null,
} satisfies NonNullable<FunctionArgs<typeof api.tasks.index.create>["properties"]>;
const stateData = {
  name: "Review",
  description: "Under review",
  color: "#ff9900",
  status: "in_progress",
  sortOrder: 10,
  isDefault: false,
} satisfies FunctionArgs<typeof api.tasks.states.save>["data"];
const labelData = { name: "Customer", description: "Customer facing work", color: "#ffaa00", sortOrder: 10 };

describe("task properties", () => {
  test("a task persists canonical assignees, priority, dates, labels and custom state through native reads", async () => {
    const { owner, projectId, userId } = await workspaceJourney();
    const stateId = await owner.mutation(api.tasks.states.save, { projectId, data: stateData });
    const labelId = await owner.mutation(api.tasks.labels.save, { projectId, data: labelData });
    const details = {
      ...properties,
      priority: "high" as const,
      assigneeIds: [userId],
      labelIds: [labelId],
      stateId,
      startDate: "2026-09-27",
      targetDate: "2026-10-01",
    };
    const taskId = await owner.mutation(api.tasks.index.create, {
      projectId,
      title: "Release",
      description: "Customer release",
      properties: details,
    });
    expect(await owner.query(api.tasks.index.get, { taskId })).toMatchObject({
      ...details,
      title: "Release",
      description: "Customer release",
      status: "in_progress",
      completedAt: null,
    });
    await owner.mutation(api.tasks.index.update, {
      taskId,
      title: "Release v2",
      description: "Updated",
      status: "in_progress",
      ...details,
      priority: "urgent",
    });
    expect(await owner.query(api.tasks.index.get, { taskId })).toMatchObject({
      priority: "urgent",
      title: "Release v2",
      assigneeIds: [userId],
      stateId,
    });
  });
  test("completing and reopening a task maintains completion timestamp and clears incompatible custom state", async () => {
    const { owner, projectId } = await workspaceJourney();
    const stateId = await owner.mutation(api.tasks.states.save, { projectId, data: stateData });
    const taskId = await owner.mutation(api.tasks.index.create, {
      projectId,
      title: "Review",
      properties: { ...properties, stateId },
    });
    await owner.mutation(api.tasks.index.setStatus, { taskId, status: "done" });
    const completed = await owner.query(api.tasks.index.get, { taskId });
    expect(completed.stateId).toBeNull();
    expect(completed.completedAt).toEqual(expect.any(Number));
    await owner.mutation(api.tasks.index.setStatus, { taskId, status: "done" });
    expect((await owner.query(api.tasks.index.get, { taskId })).completedAt).toBe(completed.completedAt);
    await owner.mutation(api.tasks.index.update, {
      taskId,
      title: "Notes only",
      description: "",
      status: "done",
      ...properties,
    });
    expect((await owner.query(api.tasks.index.get, { taskId })).completedAt).toBe(completed.completedAt);
    await owner.mutation(api.tasks.index.setStatus, { taskId, status: "todo" });
    expect((await owner.query(api.tasks.index.get, { taskId })).completedAt).toBeNull();
  });
  test("rejects cross-project labels and states instead of silently dropping requested relationships", async () => {
    const { owner, projectId, workspaceId } = await workspaceJourney();
    const other = await owner.mutation(api.projects.index.create, { workspaceId, name: "Other", identifier: "OTHER" });
    const stateId = await owner.mutation(api.tasks.states.save, { projectId: other, data: stateData });
    const labelId = await owner.mutation(api.tasks.labels.save, { projectId: other, data: labelData });
    await expect(
      owner.mutation(api.tasks.index.create, { projectId, title: "Invalid", properties: { ...properties, stateId } })
    ).rejects.toThrow("State must belong");
    await expect(
      owner.mutation(api.tasks.index.create, {
        projectId,
        title: "Invalid",
        properties: { ...properties, labelIds: [labelId] },
      })
    ).rejects.toThrow("Labels must belong");
    expect(
      (await owner.query(api.tasks.index.list, { projectId, paginationOpts: { numItems: 20, cursor: null } })).page
    ).toEqual([]);
  });
  test("assignees must remain active writers in both the project and workspace", async () => {
    const { t, owner, projectId, workspaceId } = await workspaceJourney();
    const userId = await t.run((ctx) => ctx.db.insert("users", { name: "Assignee" }));
    await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "member" });
    await expect(
      owner.mutation(api.tasks.index.create, {
        projectId,
        title: "Assign",
        properties: { ...properties, assigneeIds: [userId] },
      })
    ).rejects.toThrow("active project writers");
    await owner.mutation(api.projects.index.grantMember, { projectId, userId, role: "guest" });
    await expect(
      owner.mutation(api.tasks.index.create, {
        projectId,
        title: "Assign",
        properties: { ...properties, assigneeIds: [userId] },
      })
    ).rejects.toThrow("active project writers");
    await owner.mutation(api.projects.index.grantMember, { projectId, userId, role: "member" });
    const taskId = await owner.mutation(api.tasks.index.create, {
      projectId,
      title: "Assign",
      properties: { ...properties, assigneeIds: [userId] },
    });
    expect(
      (
        await owner.query(api.tasks.assignees.list, { projectId, paginationOpts: { numItems: 20, cursor: null } })
      ).page.map((user) => user.id)
    ).toContain(userId);
    await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "guest" });
    await expect(
      owner.mutation(api.tasks.index.update, {
        taskId,
        title: "Assign",
        description: "",
        status: "todo",
        ...properties,
        assigneeIds: [userId],
      })
    ).rejects.toThrow("active project writers");
    expect(
      (
        await owner.query(api.tasks.assignees.list, { projectId, paginationOpts: { numItems: 20, cursor: null } })
      ).page.map((user) => user.id)
    ).not.toContain(userId);
  });
  test("rejects impossible dates, duplicate relationships and a status inconsistent with its custom state", async () => {
    const { owner, projectId, userId } = await workspaceJourney();
    const stateId = await owner.mutation(api.tasks.states.save, { projectId, data: stateData });
    await expect(
      owner.mutation(api.tasks.index.create, {
        projectId,
        title: "Invalid",
        properties: { ...properties, startDate: "2026-02-30" },
      })
    ).rejects.toThrow("date");
    await expect(
      owner.mutation(api.tasks.index.create, {
        projectId,
        title: "Invalid",
        properties: { ...properties, startDate: "2026-10-01", targetDate: "2026-09-27" },
      })
    ).rejects.toThrow("exceed");
    await expect(
      owner.mutation(api.tasks.index.create, {
        projectId,
        title: "Invalid",
        properties: { ...properties, assigneeIds: [userId, userId] },
      })
    ).rejects.toThrow("distinct");
    await expect(
      owner.mutation(api.tasks.index.create, {
        projectId,
        title: "Invalid",
        status: "done",
        properties: { ...properties, stateId },
      })
    ).rejects.toThrow("must match");
  });
});
describe("project task taxonomy", () => {
  test("project defaults are unique and new tasks use the current default custom state", async () => {
    const { owner, projectId } = await workspaceJourney();
    const first = await owner.mutation(api.tasks.states.save, { projectId, data: { ...stateData, isDefault: true } });
    const second = await owner.mutation(api.tasks.states.save, {
      projectId,
      data: { ...stateData, name: "Intake", status: "backlog", isDefault: true },
    });
    const states = await owner.query(api.tasks.states.list, { projectId });
    expect(states.filter((state) => state.isDefault).map((state) => state._id)).toEqual([second]);
    const taskId = await owner.mutation(api.tasks.index.create, { projectId, title: "Default" });
    expect(await owner.query(api.tasks.index.get, { taskId })).toMatchObject({ stateId: second, status: "backlog" });
    await expect(owner.mutation(api.tasks.states.remove, { stateId: second })).rejects.toThrow("default");
    await owner.mutation(api.tasks.states.remove, { stateId: first });
  });
  test("a populated custom state can be renamed but cannot change group or be deleted until tasks move", async () => {
    const { owner, projectId } = await workspaceJourney();
    const stateId = await owner.mutation(api.tasks.states.save, { projectId, data: stateData });
    const taskId = await owner.mutation(api.tasks.index.create, {
      projectId,
      title: "Review",
      properties: { ...properties, stateId },
    });
    await owner.mutation(api.tasks.states.save, { projectId, stateId, data: { ...stateData, name: "Reviewing" } });
    await expect(
      owner.mutation(api.tasks.states.save, { projectId, stateId, data: { ...stateData, status: "done" } })
    ).rejects.toThrow("Move tasks");
    await expect(owner.mutation(api.tasks.states.remove, { stateId })).rejects.toThrow("Move tasks");
    await owner.mutation(api.tasks.index.setStatus, { taskId, status: "todo" });
    await owner.mutation(api.tasks.states.save, { projectId, stateId, data: { ...stateData, status: "done" } });
    await owner.mutation(api.tasks.states.remove, { stateId });
  });
  test("task taxonomy names are unique within the project and members cannot edit administrative taxonomy", async () => {
    const { t, owner, workspaceId, projectId } = await workspaceJourney();
    await owner.mutation(api.tasks.states.save, { projectId, data: stateData });
    await owner.mutation(api.tasks.labels.save, { projectId, data: labelData });
    await expect(owner.mutation(api.tasks.states.save, { projectId, data: stateData })).rejects.toThrow(
      "already exists"
    );
    await expect(owner.mutation(api.tasks.labels.save, { projectId, data: labelData })).rejects.toThrow(
      "already exists"
    );
    const userId = await t.run((ctx) => ctx.db.insert("users", { name: "Member" }));
    await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId, role: "member" });
    await owner.mutation(api.projects.index.grantMember, { projectId, userId, role: "member" });
    const member = t.withIdentity({ subject: userId });
    expect(await member.query(api.tasks.states.list, { projectId })).toHaveLength(1);
    await expect(
      member.mutation(api.tasks.states.save, { projectId, data: { ...stateData, name: "New" } })
    ).rejects.toThrow("administrators");
    await expect(
      member.mutation(api.tasks.labels.save, { projectId, data: { ...labelData, name: "New" } })
    ).rejects.toThrow("administrators");
  });
});

describe("workspace task center", () => {
  test("scopes and due filters use canonical properties across accessible projects without revealing other projects", async () => {
    const { t, owner, workspaceId, projectId, userId } = await workspaceJourney();
    const mine = await owner.mutation(api.tasks.index.create, {
      projectId,
      title: "Mine overdue",
      properties: { ...properties, assigneeIds: [userId], targetDate: "2026-09-26", priority: "high" },
    });
    const completed = await owner.mutation(api.tasks.index.create, {
      projectId,
      title: "Completed",
      status: "done",
      properties: { ...properties, targetDate: "2026-09-25" },
    });
    const otherId = await t.run((ctx) => ctx.db.insert("users", { name: "Other" }));
    await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId: otherId, role: "admin" });
    const other = t.withIdentity({ subject: otherId });
    const secretProject = await other.mutation(api.projects.index.create, {
      workspaceId,
      name: "Private",
      identifier: "PVT",
    });
    await other.mutation(api.tasks.index.create, { projectId: secretProject, title: "Secret" });
    const input = {
      workspaceId,
      paginationOpts: { numItems: 100, cursor: null },
      scope: "all" as const,
      due: "all" as const,
      today: "2026-09-27",
    };
    expect((await owner.query(api.tasks.center.list, input)).page.map((row) => row.task._id).toSorted()).toEqual(
      [mine, completed].toSorted()
    );
    expect(
      (await owner.query(api.tasks.center.list, { ...input, scope: "mine", due: "overdue" })).page.map(
        (row) => row.task._id
      )
    ).toEqual([mine]);
    expect(
      (await owner.query(api.tasks.center.list, { ...input, due: "completed" })).page.map((row) => row.task._id)
    ).toEqual([completed]);
    expect(
      (await owner.query(api.tasks.center.list, { ...input, priority: "high", search: "DLV-1" })).page.map(
        (row) => row.task._id
      )
    ).toEqual([mine]);
    await owner.mutation(api.projects.index.grantMember, { projectId, userId: otherId, role: "member" });
    const colleagueTask = await other.mutation(api.tasks.index.create, {
      projectId,
      title: "Team",
      properties: { ...properties, assigneeIds: [otherId], targetDate: "2026-09-27" },
    });
    expect(
      (await owner.query(api.tasks.center.list, { ...input, scope: "team", due: "today" })).page.map(
        (row) => row.task._id
      )
    ).toEqual([colleagueTask]);
    expect(
      (await owner.query(api.tasks.center.list, { ...input, scope: "created" })).page
        .map((row) => row.task._id)
        .toSorted()
    ).toEqual([mine, completed].toSorted());
  });
  test("filtered pagination can advance beyond an empty page without losing later matching records", async () => {
    const { owner, workspaceId, projectId, userId } = await workspaceJourney();
    const taskId = await owner.mutation(api.tasks.index.create, {
      projectId,
      title: "Assigned",
      properties: { ...properties, assigneeIds: [userId] },
    });
    await owner.mutation(api.tasks.index.create, { projectId, title: "Unassigned" });
    const input = {
      workspaceId,
      scope: "mine" as const,
      due: "all" as const,
      today: "2026-09-27",
      paginationOpts: { numItems: 1, cursor: null },
    };
    const first = await owner.query(api.tasks.center.list, input);
    expect(first.page).toEqual([]);
    expect(first.isDone).toBe(false);
    const second = await owner.query(api.tasks.center.list, {
      ...input,
      paginationOpts: { numItems: 1, cursor: first.continueCursor },
    });
    expect(second.page.map((row) => row.task._id)).toEqual([taskId]);
  });
});

test("task URL resolution parses IDs at the owner and does not bypass project access", async () => {
  const { t, owner, projectId, workspaceId } = await workspaceJourney();
  const taskId = await owner.mutation(api.tasks.index.create, { projectId, title: "Private detail" });
  expect(await owner.query(api.tasks.index.resolve, { taskId })).toMatchObject({ _id: taskId });
  await expect(owner.query(api.tasks.index.resolve, { taskId: "untrusted-route-value" })).rejects.toThrow("not found");
  const otherId = await t.run((ctx) => ctx.db.insert("users", { name: "Workspace admin only" }));
  await owner.mutation(api.workspaces.index.grantMember, { workspaceId, userId: otherId, role: "admin" });
  const other = t.withIdentity({ subject: otherId });
  await expect(other.query(api.tasks.index.resolve, { taskId })).rejects.toThrow("access");
  await expect(
    other.mutation(api.tasks.index.update, {
      taskId,
      title: "Unauthorized",
      description: "",
      status: "todo",
      ...properties,
    })
  ).rejects.toThrow("access");
});
