import { describe, expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";

describe("authorized task journey", () => {
  test("given an active project writer, creating and completing a task persists one status event even on retry", async () => {
    const { t, owner, projectId } = await workspaceJourney();
    const taskId = await owner.mutation(api.tasks.index.create, { projectId, title: "  Review proposal  " });
    await owner.mutation(api.tasks.index.setStatus, { taskId, status: "done" });
    await owner.mutation(api.tasks.index.setStatus, { taskId, status: "done" });
    const result = await owner.query(api.tasks.index.list, {
      projectId,
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(result.page).toMatchObject([{ _id: taskId, title: "Review proposal", sequence: 1, status: "done" }]);
    const events = await t.run((ctx) =>
      ctx.db
        .query("taskEvents")
        .withIndex("by_task", (q) => q.eq("taskId", taskId))
        .collect()
    );
    expect(events.map((e) => e.kind)).toEqual(["created", "status_changed"]);
  });
  test("given another workspace member without project access, task reads and writes are denied", async () => {
    const { t, owner, projectId, workspaceId } = await workspaceJourney();
    const taskId = await owner.mutation(api.tasks.index.create, { projectId, title: "Private" });
    const otherId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { name: "Other" });
      await ctx.db.insert("workspaceMembers", { workspaceId, userId, role: "member", active: true });
      return userId;
    });
    const other = t.withIdentity({ subject: otherId });
    await expect(
      other.query(api.tasks.index.list, { projectId, paginationOpts: { numItems: 20, cursor: null } })
    ).rejects.toThrow("access");
    await expect(other.mutation(api.tasks.index.setStatus, { taskId, status: "done" })).rejects.toThrow("access");
    expect(
      (await owner.query(api.tasks.index.list, { projectId, paginationOpts: { numItems: 20, cursor: null } })).page[0]
        .status
    ).toBe("todo");
  });
  test("given a project guest, reads succeed but writes fail; revocation also denies subsequent reads", async () => {
    const { t, owner, projectId, userId } = await workspaceJourney();
    const taskId = await owner.mutation(api.tasks.index.create, { projectId, title: "Review" });
    const memberId = await t.run(async (ctx) => {
      const member = await ctx.db
        .query("projectMembers")
        .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", userId))
        .unique();
      if (!member) throw new Error("Fixture project membership missing");
      await ctx.db.patch(member._id, { role: "guest" });
      return member._id;
    });
    expect(
      (await owner.query(api.tasks.index.list, { projectId, paginationOpts: { numItems: 20, cursor: null } })).page
    ).toHaveLength(1);
    await expect(owner.mutation(api.tasks.index.setStatus, { taskId, status: "done" })).rejects.toThrow("access");
    await t.run((ctx) => ctx.db.patch(memberId, { active: false }));
    await expect(
      owner.query(api.tasks.index.list, { projectId, paginationOpts: { numItems: 20, cursor: null } })
    ).rejects.toThrow("access");
  });
  test("given logged-out access or oversized input, no task or sequence is committed", async () => {
    const { t, owner, projectId } = await workspaceJourney();
    await expect(
      t.query(api.tasks.index.list, { projectId, paginationOpts: { numItems: 20, cursor: null } })
    ).rejects.toThrow("Sign in");
    await expect(owner.mutation(api.tasks.index.create, { projectId, title: "x".repeat(256) })).rejects.toThrow("255");
    await expect(
      owner.query(api.tasks.index.list, { projectId, paginationOpts: { numItems: 101, cursor: null } })
    ).rejects.toThrow("100");
    expect((await t.run((ctx) => ctx.db.get(projectId)))?.nextSequence).toBe(1);
  });
  test("given concurrent task creation, sequence allocation stays unique", async () => {
    const { owner, projectId } = await workspaceJourney();
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => owner.mutation(api.tasks.index.create, { projectId, title: `Task ${i}` }))
    );
    const result = await owner.query(api.tasks.index.list, {
      projectId,
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(new Set(result.page.map((task) => task.sequence)).size).toBe(10);
  });
});

describe("task page budget", () => {
  test.each([0, -1, 1.5, 101, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, -Infinity])(
    "given invalid page size %s, rejects the request at the task boundary",
    async (numItems) => {
      const { owner, projectId } = await workspaceJourney();
      await expect(
        owner.query(api.tasks.index.list, { projectId, paginationOpts: { numItems, cursor: null } })
      ).rejects.toThrow("integer between 1 and 100");
    }
  );
  test("given a caller expanding the cursor range, server row limits still split the page", async () => {
    const { owner, projectId } = await workspaceJourney();
    await Promise.all(
      Array.from({ length: 120 }, (_, i) => owner.mutation(api.tasks.index.create, { projectId, title: `Task ${i}` }))
    );
    const first = await owner.query(api.tasks.index.list, {
      projectId,
      paginationOpts: { numItems: 100, cursor: null },
    });
    const rest = await owner.query(api.tasks.index.list, {
      projectId,
      paginationOpts: { numItems: 20, cursor: first.continueCursor },
    });
    const expanded = await owner.query(api.tasks.index.list, {
      projectId,
      paginationOpts: {
        numItems: 1,
        cursor: null,
        endCursor: rest.continueCursor,
        maximumRowsRead: 10000,
        maximumBytesRead: 100000000,
      },
    });
    expect(expanded.page).toHaveLength(100);
    expect(expanded.isDone).toBe(false);
    expect(expanded.pageStatus).toBe("SplitRequired");
  });
  test("given large task descriptions, server byte limits split the page below the row limit", async () => {
    const { owner, projectId } = await workspaceJourney();
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        owner.mutation(api.tasks.index.create, { projectId, title: `Task ${i}`, description: "x".repeat(100000) })
      )
    );
    const page = await owner.query(api.tasks.index.list, {
      projectId,
      paginationOpts: { numItems: 100, cursor: null, maximumBytesRead: 100000000 },
    });
    expect(page.page.length).toBeLessThan(20);
    expect(page.page.length).toBeGreaterThan(0);
    expect(page.pageStatus).toBe("SplitRequired");
  });
});
