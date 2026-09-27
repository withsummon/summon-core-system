import { signedIn } from "../../../test-support/session";
import { createHash } from "node:crypto";
import { expect, test, vi, afterEach } from "vitest";
import { api, internal } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
const paginationOpts = { cursor: null, numItems: 100 };
afterEach(() => vi.useRealTimers());
async function fixture() {
  const f = await workspaceJourney();
  const taskId = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Files" });
  return { ...f, taskId };
}
async function member(f: Awaited<ReturnType<typeof fixture>>, role: "member" | "guest" | "admin") {
  const userId = await f.t.run((ctx) => ctx.db.insert("users", { name: role }));
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId, role });
  return { userId, user: await signedIn(f.t, userId) };
}
const text = "Attachment body";
const file = {
  name: "notes.txt",
  contentType: "text/plain",
  size: Buffer.byteLength(text),
  sha256: createHash("sha256").update(text).digest("base64"),
};
async function upload(f: Awaited<ReturnType<typeof fixture>>, user = f.owner, taskId = f.taskId) {
  const { assetId } = await user.mutation(api.assets.taskAttachments.prepare, { taskId, ...file });
  const storageId = await f.t.run((ctx) => ctx.storage.store(new Blob([text], { type: file.contentType })));
  return { assetId, storageId };
}
test("guest upload finalizes once, authenticates bytes, preserves uploader and allows uploader recovery with CAS", async () => {
  const f = await fixture();
  await f.t.run((ctx) => ctx.db.patch(f.projectId, { guestViewAllFeatures: true }));
  const guest = await member(f, "guest");
  const ticket = await upload(f, guest.user);
  expect(
    (await guest.user.query(api.assets.taskAttachments.list, { taskId: f.taskId, deleted: false, paginationOpts })).page
  ).toEqual([]);
  await guest.user.action(api.assets.upload.finalize, ticket);
  const after = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await guest.user.action(api.assets.upload.finalize, ticket);
  expect((await f.owner.query(api.tasks.index.get, { taskId: f.taskId })).updatedAt).toBe(after.updatedAt);
  const row = await guest.user.query(api.assets.taskAttachments.get, { taskId: f.taskId, assetId: ticket.assetId });
  expect(row).toMatchObject({ createdBy: guest.userId, canRemove: true, revision: 0, taskId: f.taskId });
  expect(row).not.toHaveProperty("storageId");
  const response = await guest.user.fetch(row.downloadPath);
  expect(response.status).toBe(200);
  expect(await response.text()).toBe(text);
  expect((await f.t.fetch(row.downloadPath)).status).toBe(401);
  await guest.user.mutation(api.assets.taskAttachments.change, {
    taskId: f.taskId,
    assetId: row.id,
    expectedRevision: 0,
    deleted: true,
  });
  expect((await guest.user.fetch(row.downloadPath)).status).toBe(403);
  const removed = await guest.user.query(api.assets.taskAttachments.get, { taskId: f.taskId, assetId: row.id });
  expect(removed.canRestore).toBe(true);
  await expect(
    guest.user.mutation(api.assets.taskAttachments.change, {
      taskId: f.taskId,
      assetId: row.id,
      expectedRevision: 0,
      deleted: false,
    })
  ).rejects.toThrow("changed");
  await guest.user.mutation(api.assets.taskAttachments.change, {
    taskId: f.taskId,
    assetId: row.id,
    expectedRevision: removed.revision,
    deleted: false,
  });
  expect((await guest.user.fetch(row.downloadPath)).status).toBe(200);
});
test("asset uploader owns removal, not task creator; generic APIs cannot bypass task ownership", async () => {
  const f = await fixture();
  await f.t.run((ctx) => ctx.db.patch(f.projectId, { guestViewAllFeatures: true }));
  const author = await member(f, "member");
  const uploader = await member(f, "guest");
  const taskId = await author.user.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Author" });
  const ticket = await upload(f, uploader.user, taskId);
  await uploader.user.action(api.assets.upload.finalize, ticket);
  expect((await author.user.query(api.assets.taskAttachments.get, { taskId, assetId: ticket.assetId })).canRemove).toBe(
    false
  );
  await expect(
    author.user.mutation(api.assets.taskAttachments.change, {
      taskId,
      assetId: ticket.assetId,
      expectedRevision: 0,
      deleted: true,
    })
  ).rejects.toThrow("uploader");
  await expect(author.user.mutation(api.assets.index.remove, { assetId: ticket.assetId })).rejects.toThrow(
    "task attachments"
  );
  await expect(
    author.user.mutation(api.assets.index.prepare, {
      ...file,
      taskId,
      workspaceId: f.workspaceId,
      projectId: f.projectId,
      documentId: null,
    })
  ).rejects.toThrow("task attachments");
  const another = await author.user.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Other" });
  await expect(
    author.user.query(api.assets.taskAttachments.get, { taskId: another, assetId: ticket.assetId })
  ).rejects.toThrow("not found");
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: author.userId,
    role: "admin",
  });
  await f.owner.mutation(api.projects.index.grantMember, {
    projectId: f.projectId,
    userId: author.userId,
    role: "guest",
  });
  expect((await author.user.query(api.assets.taskAttachments.get, { taskId, assetId: ticket.assetId })).canRemove).toBe(
    true
  );
  await author.user.mutation(api.assets.taskAttachments.change, {
    taskId,
    assetId: ticket.assetId,
    expectedRevision: 0,
    deleted: true,
  });
  expect(
    (await uploader.user.query(api.assets.taskAttachments.list, { taskId, deleted: true, paginationOpts })).page
  ).toHaveLength(1);
});
test("claim and commit recheck archive/deletion and uploader membership across asynchronous validation", async () => {
  const f = await fixture();
  const editor = await member(f, "member");
  const ticket = await upload(f, editor.user);
  await editor.user.mutation(internal.assets.index.claim, ticket);
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskId, status: "done" });
  let task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: task.updatedAt,
    operation: "archive",
  });
  await expect(editor.user.mutation(internal.assets.index.commit, { assetId: ticket.assetId })).rejects.toThrow(
    "read-only"
  );
  await expect(editor.user.action(api.assets.upload.finalize, ticket)).rejects.toThrow("read-only");
  await expect(upload(f, editor.user)).rejects.toThrow("read-only");
  task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: task.updatedAt,
    operation: "unarchive",
  });
  await f.owner.mutation(api.projects.index.revokeMember, { projectId: f.projectId, userId: editor.userId });
  await expect(editor.user.action(api.assets.upload.finalize, ticket)).rejects.toThrow("access");
  await f.owner.mutation(api.projects.index.grantMember, {
    projectId: f.projectId,
    userId: editor.userId,
    role: "member",
  });
  await editor.user.action(api.assets.upload.finalize, ticket);
  task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: task.updatedAt,
    operation: "delete",
  });
  expect((await editor.user.fetch(`/assets/${ticket.assetId}`)).status).toBe(403);
  await expect(
    editor.user.query(api.assets.taskAttachments.list, { taskId: f.taskId, deleted: false, paginationOpts })
  ).rejects.toThrow("not found");
  const deleted = await f.owner.query(api.tasks.lifecycle.get, { taskId: f.taskId, view: "deleted" });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: deleted.updatedAt,
    operation: "restore",
  });
  expect((await editor.user.fetch(`/assets/${ticket.assetId}`)).status).toBe(200);
});
test("intake scope blocks noncreator guests, rechecks flag at finalize, and survives acceptance by task ID", async () => {
  const f = await fixture();
  const creator = await member(f, "guest");
  const other = await member(f, "guest");
  await f.owner.mutation(api.intakes.index.configure, {
    projectId: f.projectId,
    expectedRevision: 0,
    enabled: true,
    guestViewAllFeatures: false,
  });
  const taskId = await creator.user.mutation(api.intakes.index.submit, {
    projectId: f.projectId,
    title: "Intake",
    html: "",
    priority: "none",
  });
  const ticket = await upload(f, creator.user, taskId);
  await creator.user.action(api.assets.upload.finalize, ticket);
  expect((await other.user.fetch(`/assets/${ticket.assetId}`)).status).toBe(403);
  await expect(upload(f, other.user, taskId)).rejects.toThrow("not found");
  await f.owner.mutation(api.intakes.index.configure, {
    projectId: f.projectId,
    expectedRevision: 1,
    enabled: true,
    guestViewAllFeatures: true,
  });
  const otherTicket = await upload(f, other.user, taskId);
  await f.owner.mutation(api.intakes.index.configure, {
    projectId: f.projectId,
    expectedRevision: 2,
    enabled: true,
    guestViewAllFeatures: false,
  });
  await expect(other.user.action(api.assets.upload.finalize, otherTicket)).rejects.toThrow("not found");
  await f.owner.mutation(api.tasks.states.save, {
    projectId: f.projectId,
    data: { name: "Todo", description: "", color: "", status: "todo", sortOrder: 0, isDefault: true },
  });
  const intake = await f.owner.query(api.intakes.index.get, { taskId });
  await f.owner.mutation(api.intakes.index.decide, {
    taskId,
    expectedUpdatedAt: intake.intake.updatedAt,
    expectedTaskUpdatedAt: intake.task.updatedAt,
    status: "accepted",
    snoozedUntil: null,
    duplicateTo: null,
  });
  expect((await other.user.fetch(`/assets/${ticket.assetId}`)).status).toBe(403);
  expect((await creator.user.query(api.assets.taskAttachments.get, { taskId, assetId: ticket.assetId })).taskId).toBe(
    taskId
  );
});
test("archive preserves reads, blocks attachment recovery; expiry cleans bytes without changing other assets", async () => {
  vi.useFakeTimers();
  const f = await fixture();
  const ticket = await upload(f);
  await f.owner.action(api.assets.upload.finalize, ticket);
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskId, status: "done" });
  let task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: task.updatedAt,
    operation: "archive",
  });
  expect((await f.owner.fetch(`/assets/${ticket.assetId}`)).status).toBe(200);
  expect(
    (await f.owner.query(api.assets.taskAttachments.get, { taskId: f.taskId, assetId: ticket.assetId })).canRemove
  ).toBe(false);
  await expect(
    f.owner.mutation(api.assets.taskAttachments.change, {
      taskId: f.taskId,
      assetId: ticket.assetId,
      expectedRevision: 0,
      deleted: true,
    })
  ).rejects.toThrow("read-only");
  task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: task.updatedAt,
    operation: "unarchive",
  });
  await f.owner.mutation(api.assets.taskAttachments.change, {
    taskId: f.taskId,
    assetId: ticket.assetId,
    expectedRevision: 0,
    deleted: true,
  });
  const row = await f.owner.query(api.assets.taskAttachments.get, { taskId: f.taskId, assetId: ticket.assetId });
  vi.setSystemTime(row.restoreUntil!);
  await expect(
    f.owner.mutation(api.assets.taskAttachments.change, {
      taskId: f.taskId,
      assetId: ticket.assetId,
      expectedRevision: row.revision,
      deleted: false,
    })
  ).rejects.toThrow("expired");
  await f.t.mutation(internal.assets.cleanup.sweep, { cursor: null });
  expect(await f.t.run((ctx) => ctx.db.system.get(ticket.storageId))).toBeNull();
  expect(
    (await f.owner.query(api.assets.taskAttachments.get, { taskId: f.taskId, assetId: ticket.assetId })).canRestore
  ).toBe(false);
});
