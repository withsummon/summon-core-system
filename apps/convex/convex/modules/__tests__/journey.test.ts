import { signedIn } from "../../../test-support/session";
import { expect, test, vi } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
const draft = {
  name: "Delivery",
  descriptionHtml: "<p>Ship &amp; learn</p>",
  startDate: null,
  targetDate: null,
  status: "backlog" as const,
  leadId: null,
};
async function fixture() {
  const f = await workspaceJourney();
  const moduleId = await f.owner.mutation(api.modules.index.create, {
    projectId: f.projectId,
    ...draft,
  });
  return { ...f, moduleId };
}
test("module content has one sanitizer/date owner and explicit status; indexed names reject duplicates", async () => {
  const f = await fixture();
  const row = await f.owner.query(api.modules.index.get, { moduleId: f.moduleId });
  expect(row.description).toBe("Ship & learn");
  await expect(
    f.owner.mutation(api.modules.index.create, {
      projectId: f.projectId,
      ...draft,
      name: " Delivery ",
    })
  ).rejects.toThrow("already exists");
  await Promise.all(
    [
      { startDate: "2026-02-30", targetDate: null },
      { startDate: "2026-03-02", targetDate: "2026-03-01" },
    ].map((dates) =>
      expect(
        f.owner.mutation(api.modules.index.create, {
          projectId: f.projectId,
          ...draft,
          name: "Invalid",
          ...dates,
        })
      ).rejects.toThrow()
    )
  );
  const id = await f.owner.mutation(api.modules.index.create, {
    projectId: f.projectId,
    ...draft,
    name: "One date",
    targetDate: "2028-02-29",
    descriptionHtml: "<script>alert(1)</script><p>safe</p>",
  });
  expect((await f.owner.query(api.modules.index.get, { moduleId: id })).descriptionHtml).toBe("<p>safe</p>");
});
test("many-to-many membership preserves other modules, task revisions and idempotent event delivery", async () => {
  const f = await fixture();
  const other = await f.owner.mutation(api.modules.index.create, {
    projectId: f.projectId,
    ...draft,
    name: "Other",
  });
  const taskId = await f.owner.mutation(api.tasks.index.create, {
    projectId: f.projectId,
    title: "Ship",
  });
  async function assign(moduleId: typeof f.moduleId, assigned = true) {
    const [task, module] = await Promise.all([
      f.t.run((ctx) => ctx.db.get(taskId)),
      f.owner.query(api.modules.index.get, { moduleId }),
    ]);
    await f.owner.mutation(api.modules.tasks.set, {
      moduleId,
      taskId,
      assigned,
      expectedTaskUpdatedAt: task!.updatedAt,
      expectedModuleUpdatedAt: module.updatedAt,
    });
  }
  await assign(f.moduleId);
  await assign(other);
  const before = await f.t.run((ctx) => ctx.db.get(taskId));
  await assign(other);
  expect((await f.t.run((ctx) => ctx.db.get(taskId)))!.updatedAt).toBe(before!.updatedAt);
  const paginationOpts = { cursor: null, numItems: 10 };
  expect((await f.owner.query(api.modules.tasks.forTask, { taskId, paginationOpts })).page).toHaveLength(2);
  await assign(f.moduleId, false);
  expect((await f.owner.query(api.modules.tasks.forTask, { taskId, paginationOpts })).page.map((m) => m._id)).toEqual([
    other,
  ]);
  expect(await f.t.run((ctx) => ctx.db.get(taskId))).not.toBeNull();
});
test("archive restrictions, frozen-clock CAS, reversible trash and name conflicts are transactional", async () => {
  const f = await fixture();
  const initial = await f.owner.query(api.modules.index.get, { moduleId: f.moduleId });
  await expect(
    f.owner.mutation(api.modules.index.lifecycle, {
      moduleId: f.moduleId,
      expectedUpdatedAt: initial.updatedAt,
      operation: "archive",
    })
  ).rejects.toThrow("completed or cancelled");
  vi.useFakeTimers();
  vi.setSystemTime(initial.updatedAt);
  try {
    await f.owner.mutation(api.modules.index.update, {
      moduleId: f.moduleId,
      expectedUpdatedAt: initial.updatedAt,
      ...draft,
      status: "completed",
    });
    await expect(
      f.owner.mutation(api.modules.index.update, {
        moduleId: f.moduleId,
        expectedUpdatedAt: initial.updatedAt,
        ...draft,
      })
    ).rejects.toThrow("changed");
    const next = await f.owner.query(api.modules.index.get, { moduleId: f.moduleId });
    expect(next.updatedAt).toBe(initial.updatedAt + 1);
    await f.owner.mutation(api.modules.index.lifecycle, {
      moduleId: f.moduleId,
      expectedUpdatedAt: next.updatedAt,
      operation: "archive",
    });
    const archived = await f.owner.query(api.modules.index.get, { moduleId: f.moduleId });
    await expect(
      f.owner.mutation(api.modules.index.update, {
        moduleId: f.moduleId,
        expectedUpdatedAt: archived.updatedAt,
        ...draft,
      })
    ).rejects.toThrow("unarchive");
    await f.owner.mutation(api.modules.index.lifecycle, {
      moduleId: f.moduleId,
      expectedUpdatedAt: archived.updatedAt,
      operation: "delete",
    });
    await f.owner.mutation(api.modules.index.create, { projectId: f.projectId, ...draft });
    const deleted = await f.owner.query(api.modules.index.get, { moduleId: f.moduleId });
    await expect(
      f.owner.mutation(api.modules.index.lifecycle, {
        moduleId: f.moduleId,
        expectedUpdatedAt: deleted.updatedAt,
        operation: "restore",
      })
    ).rejects.toThrow("already exists");
    expect((await f.owner.query(api.modules.index.get, { moduleId: f.moduleId })).deleted).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});
test("lead and roster require current project membership, roster does not confer write access", async () => {
  const f = await fixture();
  const guestId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Guest" }));
  const guest = await signedIn(f.t, guestId);
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: guestId,
    role: "guest",
  });
  await f.owner.mutation(api.projects.index.grantMember, {
    projectId: f.projectId,
    userId: guestId,
    role: "guest",
  });
  const module = await f.owner.query(api.modules.index.get, { moduleId: f.moduleId });
  await f.owner.mutation(api.modules.members.set, {
    moduleId: f.moduleId,
    userId: guestId,
    assigned: true,
    expectedUpdatedAt: module.updatedAt,
  });
  expect((await guest.query(api.modules.index.get, { moduleId: f.moduleId })).canEdit).toBe(false);
  await expect(
    guest.mutation(api.modules.index.create, { projectId: f.projectId, ...draft, name: "Denied" })
  ).rejects.toThrow();
  const stranger = await f.t.run((ctx) => ctx.db.insert("users", { name: "Stranger" }));
  const current = await f.owner.query(api.modules.index.get, { moduleId: f.moduleId });
  await expect(
    f.owner.mutation(api.modules.index.update, {
      moduleId: f.moduleId,
      expectedUpdatedAt: current.updatedAt,
      ...draft,
      leadId: stranger,
    })
  ).rejects.toThrow("active member");
});
test("deleted modules preserve tasks, restore recovers retained links, and cross-project links fail", async () => {
  const f = await fixture();
  const taskId = await f.owner.mutation(api.tasks.index.create, {
    projectId: f.projectId,
    title: "Keep me",
  });
  const module = await f.owner.query(api.modules.index.get, { moduleId: f.moduleId });
  const task = await f.t.run((ctx) => ctx.db.get(taskId));
  await f.owner.mutation(api.modules.tasks.set, {
    moduleId: f.moduleId,
    taskId,
    assigned: true,
    expectedTaskUpdatedAt: task!.updatedAt,
    expectedModuleUpdatedAt: module.updatedAt,
  });
  await f.owner.mutation(api.modules.index.lifecycle, {
    moduleId: f.moduleId,
    operation: "delete",
    expectedUpdatedAt: module.updatedAt,
  });
  const paginationOpts = { cursor: null, numItems: 10 };
  expect((await f.owner.query(api.modules.tasks.forTask, { taskId, paginationOpts })).page).toHaveLength(0);
  expect(await f.t.run((ctx) => ctx.db.get(taskId))).not.toBeNull();
  const deleted = await f.owner.query(api.modules.index.get, { moduleId: f.moduleId });
  await f.owner.mutation(api.modules.index.lifecycle, {
    moduleId: f.moduleId,
    operation: "restore",
    expectedUpdatedAt: deleted.updatedAt,
  });
  expect((await f.owner.query(api.modules.tasks.forTask, { taskId, paginationOpts })).page).toHaveLength(1);
  const otherProject = await f.owner.mutation(api.projects.index.create, {
    workspaceId: f.workspaceId,
    name: "Other",
    identifier: "OTH",
  });
  const otherTask = await f.owner.mutation(api.tasks.index.create, {
    projectId: otherProject,
    title: "Other task",
  });
  const otherRow = await f.t.run((ctx) => ctx.db.get(otherTask));
  const current = await f.owner.query(api.modules.index.get, { moduleId: f.moduleId });
  await expect(
    f.owner.mutation(api.modules.tasks.set, {
      moduleId: f.moduleId,
      taskId: otherTask,
      assigned: true,
      expectedTaskUpdatedAt: otherRow!.updatedAt,
      expectedModuleUpdatedAt: current.updatedAt,
    })
  ).rejects.toThrow("another project");
  await Promise.all(
    [0, 101, 1.5].map((numItems) =>
      expect(
        f.owner.query(api.modules.index.list, {
          projectId: f.projectId,
          deleted: false,
          paginationOpts: { cursor: null, numItems },
        })
      ).rejects.toThrow("Page size")
    )
  );
});
test("current ACL governs metadata, roster and tasks; noncreator members cannot delete", async () => {
  const f = await fixture();
  const memberId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Member" }));
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: memberId,
    role: "member",
  });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId: memberId, role: "member" });
  const member = await signedIn(f.t, memberId);
  const row = await member.query(api.modules.index.get, { moduleId: f.moduleId });
  expect(row.canEdit).toBe(true);
  expect(row.canDelete).toBe(false);
  await expect(
    member.mutation(api.modules.index.lifecycle, {
      moduleId: f.moduleId,
      expectedUpdatedAt: row.updatedAt,
      operation: "delete",
    })
  ).rejects.toThrow("creator");
  await member.mutation(api.modules.index.update, {
    moduleId: f.moduleId,
    expectedUpdatedAt: row.updatedAt,
    ...draft,
    leadId: memberId,
  });
  expect((await member.query(api.modules.index.get, { moduleId: f.moduleId })).lead?.id).toBe(memberId);
  await f.owner.mutation(api.projects.index.revokeMember, { projectId: f.projectId, userId: memberId });
  await expect(member.query(api.modules.index.resolve, { moduleId: f.moduleId })).rejects.toThrow("access");
  const current = await f.owner.query(api.modules.index.get, { moduleId: f.moduleId });
  await f.owner.mutation(api.modules.index.update, {
    moduleId: f.moduleId,
    expectedUpdatedAt: current.updatedAt,
    ...draft,
    leadId: memberId,
    name: "Historical lead",
  });
  expect(
    (
      await f.owner.query(api.modules.members.choices, {
        projectId: f.projectId,
        paginationOpts: { cursor: null, numItems: 100 },
      })
    ).page.map((user) => user.id)
  ).not.toContain(memberId);
  const latest = await f.owner.query(api.modules.index.get, { moduleId: f.moduleId });
  await expect(
    f.owner.mutation(api.modules.members.set, {
      moduleId: f.moduleId,
      userId: memberId,
      assigned: true,
      expectedUpdatedAt: latest.updatedAt,
    })
  ).rejects.toThrow("active member");
});
