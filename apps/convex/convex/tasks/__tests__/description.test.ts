import { describe, expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";

describe("canonical task rich description", () => {
  test("initial plain text escapes markup while preserving existing text consumers", async () => {
    const { owner, projectId } = await workspaceJourney();
    const taskId = await owner.mutation(api.tasks.index.create, {
      projectId,
      title: "Plan",
      description: "<hello> & team\nNext line",
    });
    const rich = await owner.query(api.tasks.description.get, { taskId });
    expect(rich.html).toBe("<p>&lt;hello&gt; &amp; team</p><p>Next line</p>");
    expect((await owner.query(api.tasks.index.get, { taskId })).description).toBe("<hello> & team\nNext line");
  });
  test("rich save retains lists and emphasis, strips active content, derives decoded text and rejects stale save", async () => {
    const { owner, projectId } = await workspaceJourney();
    const taskId = await owner.mutation(api.tasks.index.create, { projectId, title: "Plan" });
    const task = await owner.query(api.tasks.index.get, { taskId });
    await owner.mutation(api.tasks.description.save, {
      taskId,
      expectedUpdatedAt: task.updatedAt,
      html: '<p onclick="evil()"><strong>Review &amp; plan</strong></p><ul><li>First</li></ul><script>evil()</script><img src="x" onerror="evil()"><a href="javascript:evil()">Link</a>',
    });
    const rich = await owner.query(api.tasks.description.get, { taskId });
    expect(rich.html).toContain("<strong>Review &amp; plan</strong>");
    expect(rich.html).toContain("<ul><li>First</li></ul>");
    expect(rich.html).not.toMatch(/script|onclick|onerror|javascript|<img/);
    const saved = await owner.query(api.tasks.index.get, { taskId });
    expect(saved.description).toContain("Review & plan\n");
    expect(saved.description).toContain("First");
    await expect(
      owner.mutation(api.tasks.description.save, { taskId, expectedUpdatedAt: task.updatedAt, html: "<p>stale</p>" })
    ).rejects.toThrow("changed");
  });
  test("legacy text update intentionally replaces formatting rather than leaving stale rich content", async () => {
    const { owner, projectId } = await workspaceJourney();
    const taskId = await owner.mutation(api.tasks.index.create, { projectId, title: "Plan" });
    const first = await owner.query(api.tasks.index.get, { taskId });
    await owner.mutation(api.tasks.description.save, {
      taskId,
      expectedUpdatedAt: first.updatedAt,
      html: "<p><strong>Rich</strong></p>",
    });
    const task = await owner.query(api.tasks.index.get, { taskId });
    await owner.mutation(api.tasks.index.update, {
      taskId,
      expectedUpdatedAt: task.updatedAt,
      title: task.title,
      description: "Changed plain",
      status: task.status,
      priority: task.priority,
      assigneeIds: task.assigneeIds,
      labelIds: task.labelIds,
      startDate: task.startDate,
      targetDate: task.targetDate,
      stateId: task.stateId,
    });
    expect((await owner.query(api.tasks.description.get, { taskId })).html).toBe("<p>Changed plain</p>");
  });
  test("project guest cannot save and revoked membership cannot read rich data", async () => {
    const { t, owner, projectId, userId } = await workspaceJourney();
    const taskId = await owner.mutation(api.tasks.index.create, { projectId, title: "Private" });
    const task = await owner.query(api.tasks.index.get, { taskId });
    const memberId = await t.run(async (ctx) => {
      const member = await ctx.db
        .query("projectMembers")
        .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", userId))
        .unique();
      await ctx.db.patch(member!._id, { role: "guest" });
      return member!._id;
    });
    await expect(
      owner.mutation(api.tasks.description.save, { taskId, expectedUpdatedAt: task.updatedAt, html: "<p>no</p>" })
    ).rejects.toThrow("access");
    await t.run((ctx) => ctx.db.patch(memberId, { active: false }));
    await expect(owner.query(api.tasks.description.get, { taskId })).rejects.toThrow("access");
  });
});
