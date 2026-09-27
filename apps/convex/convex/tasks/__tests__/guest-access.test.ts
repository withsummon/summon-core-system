import { signedIn } from "../../../test-support/session";
import { expect, test } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
const paginationOpts = { cursor: null, numItems: 100 };
test("guest policy gates direct content, subscribed notifications, project/workspace lists, reports and graph endpoints; flag toggle applies live", async () => {
  const f = await workspaceJourney();
  const guestId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Guest" }));
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: guestId,
    role: "member",
  });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId: guestId, role: "member" });
  const guest = await signedIn(f.t, guestId);
  const own = await guest.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Own" });
  const hidden = await f.owner.mutation(api.tasks.index.create, {
    projectId: f.projectId,
    title: "Private to guest",
    description: "Hidden description",
  });
  await guest.mutation(api.notifications.index.subscribe, { taskId: hidden, subscribed: true });
  let task = await f.owner.query(api.tasks.index.get, { taskId: own });
  const parent = await f.owner.query(api.tasks.index.get, { taskId: hidden });
  await f.owner.mutation(api.tasks.hierarchy.setParent, {
    taskId: own,
    expectedUpdatedAt: task.updatedAt,
    parent: { taskId: hidden, expectedUpdatedAt: parent.updatedAt },
  });
  const commentId = await f.owner.mutation(api.tasks.comments.create, {
    taskId: hidden,
    html: "<p>Hidden comment</p>",
  });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId: guestId, role: "guest" });
  await expect(guest.query(api.tasks.index.get, { taskId: hidden })).rejects.toThrow("not found");
  await expect(guest.query(api.tasks.description.get, { taskId: hidden })).rejects.toThrow("not found");
  await expect(guest.query(api.tasks.comments.get, { taskId: hidden, commentId })).rejects.toThrow("not found");
  await expect(
    guest.query(api.assets.taskAttachments.list, { taskId: hidden, deleted: false, paginationOpts })
  ).rejects.toThrow("not found");
  expect(
    (await guest.query(api.tasks.index.list, { projectId: f.projectId, paginationOpts })).page.map((t) => t._id)
  ).toEqual([own]);
  expect(
    (await guest.query(api.reporting.overview.project, { projectId: f.projectId })).recentTasks.map((t) => t.id)
  ).toEqual([own]);
  expect(await guest.query(api.tasks.hierarchy.parent, { taskId: own })).toEqual({
    task: null,
    project: null,
    canUnlink: false,
    hasParent: true,
  });
  expect(
    (
      await guest.query(api.notifications.index.list, {
        workspaceId: f.workspaceId,
        view: "inbox",
        unreadOnly: false,
        now: Date.now(),
        paginationOpts,
      })
    ).page.every((row) => row.taskId !== hidden)
  ).toBe(true);
  const report = await guest.query(api.reporting.tasks.page, {
    scope: {
      workspaceId: f.workspaceId,
      projectId: null,
      clientId: null,
      dateFrom: null,
      dateTo: null,
      today: "2026-09-27",
    },
    paginationOpts,
  });
  expect(report).toMatchObject({ contribution: { total: 1 } });
  await f.t.run((ctx) => ctx.db.patch(f.projectId, { guestViewAllFeatures: true }));
  expect((await guest.query(api.tasks.index.get, { taskId: hidden })).title).toBe("Private to guest");
  expect((await guest.query(api.tasks.comments.access, { taskId: hidden })).canCreate).toBe(true);
  expect((await guest.query(api.tasks.hierarchy.parent, { taskId: own })).task?._id).toBe(hidden);
});
