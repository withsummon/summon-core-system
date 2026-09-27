import { signedIn } from "../../../test-support/session";
import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
const paginationOpts = { cursor: null, numItems: 50 };
async function fixture() {
  const f = await workspaceJourney();
  const taskId = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Task" });
  const commentId = await f.owner.mutation(api.tasks.comments.create, { taskId, html: "<p>Comment</p>" });
  return { ...f, taskId, commentId };
}
async function guest(f: Awaited<ReturnType<typeof fixture>>) {
  const userId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Guest" }));
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role: "guest" });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId, role: "guest" });
  return { userId, user: await signedIn(f.t, userId) };
}
test("comment reactions preserve actor uniqueness, independent task target and idempotent event revision", async () => {
  const f = await fixture();
  const target = { taskId: f.taskId, commentId: f.commentId };
  const first = await f.owner.mutation(api.tasks.commentReactions.set, { ...target, reaction: "128077", active: true });
  const task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  expect(await f.owner.mutation(api.tasks.commentReactions.set, { ...target, reaction: "128077", active: true })).toBe(
    first
  );
  expect((await f.owner.query(api.tasks.index.get, { taskId: f.taskId })).updatedAt).toBe(task.updatedAt);
  await f.owner.mutation(api.tasks.reactions.set, { taskId: f.taskId, reaction: "128077", active: true });
  await f.owner.mutation(api.tasks.commentReactions.set, { ...target, reaction: "128077", active: false });
  expect((await f.owner.query(api.tasks.commentReactions.list, { ...target, paginationOpts })).page).toEqual([]);
  expect((await f.owner.query(api.tasks.reactions.list, { taskId: f.taskId, paginationOpts })).page).toHaveLength(1);
  await f.owner.mutation(api.tasks.commentReactions.set, { ...target, reaction: "128077", active: true });
  expect((await f.owner.query(api.tasks.commentReactions.list, { ...target, paginationOpts })).page[0]).toMatchObject({
    actorId: f.userId,
    isMine: true,
    actorName: "Owner",
  });
});
test("guest access uses current task visibility and cannot remove another actor's reaction", async () => {
  const f = await fixture();
  const actor = await guest(f);
  const target = { taskId: f.taskId, commentId: f.commentId };
  await expect(actor.user.query(api.tasks.commentReactions.list, { ...target, paginationOpts })).rejects.toThrow(
    "not found"
  );
  await f.owner.mutation(api.intakes.index.configure, {
    projectId: f.projectId,
    expectedRevision: 0,
    enabled: false,
    guestViewAllFeatures: true,
  });
  await f.owner.mutation(api.tasks.commentReactions.set, { ...target, reaction: "128077", active: true });
  await actor.user.mutation(api.tasks.commentReactions.set, { ...target, reaction: "128077", active: false });
  expect((await actor.user.query(api.tasks.commentReactions.list, { ...target, paginationOpts })).page).toHaveLength(1);
  await actor.user.mutation(api.tasks.commentReactions.set, { ...target, reaction: "128077", active: true });
  expect((await actor.user.query(api.tasks.commentReactions.list, { ...target, paginationOpts })).page).toHaveLength(2);
  await f.owner.mutation(api.projects.index.revokeMember, { projectId: f.projectId, userId: actor.userId });
  await expect(
    actor.user.mutation(api.tasks.commentReactions.set, { ...target, reaction: "128077", active: false })
  ).rejects.toThrow("access");
});
test("deleted comments hide retained reactions until restoration; cross-task comment IDs cannot be substituted", async () => {
  const f = await fixture();
  const target = { taskId: f.taskId, commentId: f.commentId };
  await f.owner.mutation(api.tasks.commentReactions.set, { ...target, reaction: "128077", active: true });
  let comment = (await f.owner.query(api.tasks.comments.list, { taskId: f.taskId, paginationOpts })).page[0];
  await f.owner.mutation(api.tasks.comments.remove, { commentId: f.commentId, expectedUpdatedAt: comment.updatedAt });
  await expect(f.owner.query(api.tasks.commentReactions.list, { ...target, paginationOpts })).rejects.toThrow(
    "Comment not found"
  );
  await expect(
    f.owner.mutation(api.tasks.commentReactions.set, { ...target, reaction: "128077", active: false })
  ).rejects.toThrow("Comment not found");
  comment = (await f.owner.query(api.tasks.comments.list, { taskId: f.taskId, deleted: true, paginationOpts })).page[0];
  await f.owner.mutation(api.tasks.comments.restore, { commentId: f.commentId, expectedUpdatedAt: comment.updatedAt });
  expect((await f.owner.query(api.tasks.commentReactions.list, { ...target, paginationOpts })).page).toHaveLength(1);
  const other = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Other" });
  await expect(
    f.owner.query(api.tasks.commentReactions.list, { taskId: other, commentId: f.commentId, paginationOpts })
  ).rejects.toThrow("Comment not found");
});
test("archive preserves reaction reads but blocks writes; shared code and page validation stay authoritative", async () => {
  const f = await fixture();
  const target = { taskId: f.taskId, commentId: f.commentId };
  await expect(
    f.owner.mutation(api.tasks.commentReactions.set, { ...target, reaction: "127", active: true })
  ).rejects.toThrow("Unicode");
  await expect(
    f.owner.query(api.tasks.commentReactions.list, { ...target, paginationOpts: { cursor: null, numItems: 101 } })
  ).rejects.toThrow();
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskId, status: "done" });
  const task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: task.updatedAt,
    operation: "archive",
  });
  expect((await f.owner.query(api.tasks.commentReactions.access, target)).canReact).toBe(false);
  expect((await f.owner.query(api.tasks.commentReactions.list, { ...target, paginationOpts })).page).toEqual([]);
  await expect(
    f.owner.mutation(api.tasks.commentReactions.set, { ...target, reaction: "128077", active: true })
  ).rejects.toThrow("not found");
});
