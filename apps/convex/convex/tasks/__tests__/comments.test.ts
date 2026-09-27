import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
async function fixture() {
  const base = await workspaceJourney();
  const taskId = await base.owner.mutation(api.tasks.index.create, { projectId: base.projectId, title: "Comments" });
  const member = await base.t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Member" });
    await ctx.db.insert("workspaceMembers", { workspaceId: base.workspaceId, userId, role: "member", active: true });
    const memberId = await ctx.db.insert("projectMembers", {
      workspaceId: base.workspaceId,
      projectId: base.projectId,
      userId,
      role: "member",
      active: true,
    });
    return { userId, memberId };
  });
  const actor = base.t.withIdentity({ subject: member.userId });
  const page = { taskId, paginationOpts: { numItems: 20, cursor: null } };
  return { ...base, actor, member, taskId, page };
}
test("rich comment is sanitized, creator receives typed event, actor excluded and deleted text never retained in event", async () => {
  const f = await fixture();
  const commentId = await f.actor.mutation(api.tasks.comments.create, {
    taskId: f.taskId,
    html: "<p>Hello <strong>team</strong><script>alert(1)</script></p>",
  });
  const [comment] = (await f.actor.query(api.tasks.comments.list, f.page)).page;
  expect(comment.text).toBe("Hello team");
  expect(comment.html).toBe("<p>Hello <strong>team</strong></p>");
  expect(comment.canEdit).toBe(true);
  const notifications = await f.t.run((ctx) => ctx.db.query("notifications").collect());
  expect(notifications).toHaveLength(1);
  expect(notifications[0].receiverId).toBe(f.userId);
  await f.actor.mutation(api.tasks.comments.remove, { commentId, expectedUpdatedAt: comment.updatedAt });
  expect((await f.actor.query(api.tasks.comments.list, f.page)).page).toHaveLength(0);
  const events = await f.t.run((ctx) => ctx.db.query("taskEvents").collect());
  expect(events.map((e) => e.kind)).toEqual(["created", "comment_created", "comment_deleted"]);
  expect(JSON.stringify(events)).not.toContain("Hello");
});
test("author edits with CAS, stale edits fail and unchanged save emits no event", async () => {
  const f = await fixture();
  const commentId = await f.actor.mutation(api.tasks.comments.create, { taskId: f.taskId, html: "<p>Original</p>" });
  const [before] = (await f.actor.query(api.tasks.comments.list, f.page)).page;
  await f.actor.mutation(api.tasks.comments.update, {
    commentId,
    expectedUpdatedAt: before.updatedAt,
    html: "<p>Edited</p>",
  });
  await expect(
    f.actor.mutation(api.tasks.comments.update, {
      commentId,
      expectedUpdatedAt: before.updatedAt,
      html: "<p>Stale</p>",
    })
  ).rejects.toThrow("changed");
  await expect(
    f.actor.mutation(api.tasks.comments.remove, { commentId, expectedUpdatedAt: before.updatedAt })
  ).rejects.toThrow("changed");
  const [after] = (await f.actor.query(api.tasks.comments.list, f.page)).page;
  expect(after.editedAt).toBe(after.updatedAt);
  await f.actor.mutation(api.tasks.comments.update, {
    commentId,
    expectedUpdatedAt: after.updatedAt,
    html: after.html,
  });
  expect((await f.t.run((ctx) => ctx.db.query("taskEvents").collect())).map((e) => e.kind)).toEqual([
    "created",
    "comment_created",
    "comment_updated",
  ]);
});
test("ordinary non-author cannot modify; project administrator may moderate; revoked author cannot read or write", async () => {
  const f = await fixture();
  const ownId = await f.owner.mutation(api.tasks.comments.create, { taskId: f.taskId, html: "<p>Admin authored</p>" });
  const [own] = (await f.actor.query(api.tasks.comments.list, f.page)).page;
  expect(own.canEdit).toBe(false);
  await expect(
    f.actor.mutation(api.tasks.comments.remove, { commentId: ownId, expectedUpdatedAt: own.updatedAt })
  ).rejects.toThrow("author");
  const commentId = await f.actor.mutation(api.tasks.comments.create, {
    taskId: f.taskId,
    html: "<p>Member authored</p>",
  });
  const comment = await f.t.run((ctx) => ctx.db.get(commentId));
  if (!comment) throw new Error("Missing fixture comment");
  await f.owner.mutation(api.tasks.comments.update, {
    commentId,
    expectedUpdatedAt: comment.updatedAt,
    html: "<p>Moderated</p>",
  });
  await f.t.run((ctx) => ctx.db.patch(f.member.memberId, { active: false }));
  await expect(f.actor.query(api.tasks.comments.list, f.page)).rejects.toThrow("access");
  await expect(
    f.actor.mutation(api.tasks.comments.remove, { commentId, expectedUpdatedAt: comment.updatedAt })
  ).rejects.toThrow("access");
});
test("guest can comment on own task only; empty or oversized content and anonymous access fail", async () => {
  const f = await fixture();
  const ownTask = await f.actor.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Own task" });
  await f.t.run((ctx) => ctx.db.patch(f.member.memberId, { role: "guest" }));
  await expect(
    f.actor.mutation(api.tasks.comments.create, { taskId: f.taskId, html: "<p>No access</p>" })
  ).rejects.toThrow("Guests");
  await f.actor.mutation(api.tasks.comments.create, { taskId: ownTask, html: "<p>Own guest comment</p>" });
  expect((await f.actor.query(api.tasks.comments.list, f.page)).canCreate).toBe(false);
  expect(await f.actor.query(api.tasks.comments.access, { taskId: f.taskId })).toEqual({ canCreate: false });
  expect(await f.actor.query(api.tasks.comments.access, { taskId: ownTask })).toEqual({ canCreate: true });
  await expect(
    f.owner.mutation(api.tasks.comments.create, { taskId: f.taskId, html: "<p> </p><script>bad</script>" })
  ).rejects.toThrow("Write a comment");
  await expect(
    f.owner.mutation(api.tasks.comments.create, { taskId: f.taskId, html: "x".repeat(100001) })
  ).rejects.toThrow("100,000");
  await expect(f.t.query(api.tasks.comments.list, f.page)).rejects.toThrow("Sign in");
});
test("comment pagination retains cursor and server owns the page budget", async () => {
  const f = await fixture();
  await f.actor.mutation(api.tasks.comments.create, { taskId: f.taskId, html: "<p>First</p>" });
  await f.actor.mutation(api.tasks.comments.create, { taskId: f.taskId, html: "<p>Second</p>" });
  const first = await f.owner.query(api.tasks.comments.list, {
    ...f.page,
    paginationOpts: { numItems: 1, cursor: null },
  });
  const second = await f.owner.query(api.tasks.comments.list, {
    ...f.page,
    paginationOpts: { numItems: 1, cursor: first.continueCursor },
  });
  expect(first.page[0].text).toBe("Second");
  expect(second.page[0].text).toBe("First");
  await Promise.all(
    [0, 51, 1.5].map((numItems) =>
      expect(
        f.owner.query(api.tasks.comments.list, { ...f.page, paginationOpts: { numItems, cursor: null } })
      ).rejects.toThrow("50")
    )
  );
});
