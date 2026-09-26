import { describe, expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import type { Id } from "../../_generated/dataModel";

describe("task hierarchy and dependency journeys", () => {
  test("create a child atomically, list it, then unlink while retaining both tasks", async () => {
    const { owner, projectId } = await workspaceJourney();
    const parentId = await owner.mutation(api.tasks.index.create, { projectId, title: "Delivery" });
    const parent = await owner.query(api.tasks.index.get, { taskId: parentId });
    const childId = await owner.mutation(api.tasks.index.create, {
      projectId,
      title: "Review",
      parent: { taskId: parentId, expectedUpdatedAt: parent.updatedAt },
    });
    expect((await owner.query(api.tasks.hierarchy.parent, { taskId: childId }))?._id).toBe(parentId);
    expect(
      (
        await owner.query(api.tasks.hierarchy.children, {
          taskId: parentId,
          paginationOpts: { numItems: 10, cursor: null },
        })
      ).page.map((task) => task._id)
    ).toEqual([childId]);
    const child = await owner.query(api.tasks.index.get, { taskId: childId });
    await owner.mutation(api.tasks.hierarchy.setParent, {
      taskId: childId,
      expectedUpdatedAt: child.updatedAt,
      parent: null,
    });
    expect(await owner.query(api.tasks.hierarchy.parent, { taskId: childId })).toBeNull();
    expect((await owner.query(api.tasks.index.get, { taskId: childId })).title).toBe("Review");
  });
  test("reject transitive and self parenting without changing the graph", async () => {
    const { owner, projectId } = await workspaceJourney();
    const a = await owner.mutation(api.tasks.index.create, { projectId, title: "A" });
    const b = await owner.mutation(api.tasks.index.create, { projectId, title: "B" });
    const c = await owner.mutation(api.tasks.index.create, { projectId, title: "C" });
    const link = async (childId: Id<"tasks">, parentId: Id<"tasks">) => {
      const [child, parent] = await Promise.all([
        owner.query(api.tasks.index.get, { taskId: childId }),
        owner.query(api.tasks.index.get, { taskId: parentId }),
      ]);
      return owner.mutation(api.tasks.hierarchy.setParent, {
        taskId: childId,
        expectedUpdatedAt: child.updatedAt,
        parent: { taskId: parentId, expectedUpdatedAt: parent.updatedAt },
      });
    };
    await link(b, a);
    await link(c, b);
    await expect(link(a, c)).rejects.toThrow("ancestor");
    await expect(link(a, a)).rejects.toThrow("ancestor");
    expect(await owner.query(api.tasks.hierarchy.parent, { taskId: a })).toBeNull();
  });
  test("reject cross-project parents and related tasks even for a writer in both projects", async () => {
    const { owner, projectId, workspaceId } = await workspaceJourney();
    const otherProject = await owner.mutation(api.projects.index.create, {
      workspaceId,
      name: "Other",
      identifier: "OTHER",
    });
    const a = await owner.mutation(api.tasks.index.create, { projectId, title: "A" });
    const b = await owner.mutation(api.tasks.index.create, { projectId: otherProject, title: "B" });
    const [task, related] = await Promise.all([
      owner.query(api.tasks.index.get, { taskId: a }),
      owner.query(api.tasks.index.get, { taskId: b }),
    ]);
    await expect(
      owner.mutation(api.tasks.hierarchy.setParent, {
        taskId: a,
        expectedUpdatedAt: task.updatedAt,
        parent: { taskId: b, expectedUpdatedAt: related.updatedAt },
      })
    ).rejects.toThrow("same project");
    await expect(
      owner.mutation(api.tasks.relationships.add, {
        taskId: a,
        expectedUpdatedAt: task.updatedAt,
        relatedTaskId: b,
        expectedRelatedUpdatedAt: related.updatedAt,
        kind: "blocks",
      })
    ).rejects.toThrow("same project");
  });
  test("display inverse blocking and reject transitive dependency cycles and duplicate pair types", async () => {
    const { owner, projectId } = await workspaceJourney();
    const ids = await Promise.all(
      ["A", "B", "C"].map((title) => owner.mutation(api.tasks.index.create, { projectId, title }))
    );
    const add = async (from: Id<"tasks">, to: Id<"tasks">, kind: "blocks" | "duplicate" = "blocks") => {
      const [task, related] = await Promise.all([
        owner.query(api.tasks.index.get, { taskId: from }),
        owner.query(api.tasks.index.get, { taskId: to }),
      ]);
      return owner.mutation(api.tasks.relationships.add, {
        taskId: from,
        expectedUpdatedAt: task.updatedAt,
        relatedTaskId: to,
        expectedRelatedUpdatedAt: related.updatedAt,
        kind,
      });
    };
    await add(ids[0], ids[1]);
    await add(ids[1], ids[2]);
    expect(
      (await owner.query(api.tasks.relationships.list, { taskId: ids[1] })).map((item) => item.direction)
    ).toContain("blocked_by");
    await expect(add(ids[2], ids[0])).rejects.toThrow("cycle");
    await expect(add(ids[1], ids[0], "duplicate")).rejects.toThrow("already");
  });
  test("relationship changes invalidate an open task edit and guest writes are denied", async () => {
    const { t, owner, projectId, userId } = await workspaceJourney();
    const a = await owner.mutation(api.tasks.index.create, { projectId, title: "A" });
    const b = await owner.mutation(api.tasks.index.create, { projectId, title: "B" });
    const [task, related] = await Promise.all([
      owner.query(api.tasks.index.get, { taskId: a }),
      owner.query(api.tasks.index.get, { taskId: b }),
    ]);
    const args = {
      taskId: a,
      expectedUpdatedAt: task.updatedAt,
      relatedTaskId: b,
      expectedRelatedUpdatedAt: related.updatedAt,
      kind: "relates_to" as const,
    };
    await owner.mutation(api.tasks.relationships.add, args);
    await expect(
      owner.mutation(api.tasks.hierarchy.setParent, { taskId: a, expectedUpdatedAt: task.updatedAt, parent: null })
    ).rejects.toThrow("changed");
    await t.run(async (ctx) => {
      const member = await ctx.db
        .query("projectMembers")
        .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", userId))
        .unique();
      await ctx.db.patch(member!._id, { role: "guest" });
    });
    await expect(owner.mutation(api.tasks.relationships.add, args)).rejects.toThrow("access");
  });
});
