import { signedIn } from "../../../test-support/session";
import { expect, test, vi } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
const paginationOpts = { cursor: null, numItems: 100 };
async function fixture() {
  const f = await workspaceJourney();
  const taskId = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Task" });
  return { ...f, taskId };
}
async function person(f: Awaited<ReturnType<typeof fixture>>, role: "guest" | "member") {
  const userId = await f.t.run((ctx) => ctx.db.insert("users", { name: role }));
  await f.owner.mutation(api.workspaces.index.grantMember, { workspaceId: f.workspaceId, userId, role });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId, role });
  return { userId, user: await signedIn(f.t, userId) };
}
test("reaction identity is caller-owned, unique and idempotent; another actor cannot remove it", async () => {
  const f = await fixture();
  const member = await person(f, "member");
  const id = await f.owner.mutation(api.tasks.reactions.set, { taskId: f.taskId, reaction: "128077", active: true });
  const after = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  expect(await f.owner.mutation(api.tasks.reactions.set, { taskId: f.taskId, reaction: "128077", active: true })).toBe(
    id
  );
  expect((await f.owner.query(api.tasks.index.get, { taskId: f.taskId })).updatedAt).toBe(after.updatedAt);
  await member.user.mutation(api.tasks.reactions.set, { taskId: f.taskId, reaction: "128077", active: false });
  let result = await member.user.query(api.tasks.reactions.list, { taskId: f.taskId, paginationOpts });
  expect(result.page).toHaveLength(1);
  expect(result.page[0].isMine).toBe(false);
  await member.user.mutation(api.tasks.reactions.set, { taskId: f.taskId, reaction: "128077", active: true });
  await f.owner.mutation(api.tasks.reactions.set, { taskId: f.taskId, reaction: "128077", active: false });
  result = await member.user.query(api.tasks.reactions.list, { taskId: f.taskId, paginationOpts });
  expect(result.page.map((row) => row.actorId)).toEqual([member.userId]);
  await f.owner.mutation(api.tasks.reactions.set, { taskId: f.taskId, reaction: "128077", active: true });
  expect((await f.owner.query(api.tasks.reactions.list, { taskId: f.taskId, paginationOpts })).page).toHaveLength(2);
});
test("guest reaction access follows canonical task policy; archive is readable but cannot react", async () => {
  const f = await fixture();
  const guest = await person(f, "guest");
  await expect(
    guest.user.mutation(api.tasks.reactions.set, { taskId: f.taskId, reaction: "128077", active: true })
  ).rejects.toThrow("not found");
  await f.owner.mutation(api.intakes.index.configure, {
    projectId: f.projectId,
    expectedRevision: 0,
    enabled: false,
    guestViewAllFeatures: true,
  });
  await guest.user.mutation(api.tasks.reactions.set, { taskId: f.taskId, reaction: "128077", active: true });
  await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskId, status: "done" });
  const task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await f.owner.mutation(api.tasks.lifecycle.change, {
    taskId: f.taskId,
    expectedUpdatedAt: task.updatedAt,
    operation: "archive",
  });
  expect((await guest.user.query(api.tasks.reactions.access, { taskId: f.taskId })).canReact).toBe(false);
  expect((await guest.user.query(api.tasks.reactions.list, { taskId: f.taskId, paginationOpts })).page).toHaveLength(1);
  await expect(
    guest.user.mutation(api.tasks.reactions.set, { taskId: f.taskId, reaction: "128077", active: false })
  ).rejects.toThrow("not found");
  await f.owner.mutation(api.projects.index.revokeMember, { projectId: f.projectId, userId: guest.userId });
  await expect(guest.user.query(api.tasks.reactions.list, { taskId: f.taskId, paginationOpts })).rejects.toThrow(
    "access"
  );
});
test("reaction code and pagination boundaries reject invalid data without creating activity", async () => {
  const f = await fixture();
  const before = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await expect(
    f.owner.mutation(api.tasks.reactions.set, { taskId: f.taskId, reaction: "<script>", active: true })
  ).rejects.toThrow("reaction code");
  await expect(
    f.owner.mutation(api.tasks.reactions.set, { taskId: f.taskId, reaction: "1114112", active: true })
  ).rejects.toThrow("Unicode");
  await expect(
    f.owner.mutation(api.tasks.reactions.set, { taskId: f.taskId, reaction: "55296", active: true })
  ).rejects.toThrow("Unicode");
  expect((await f.owner.query(api.tasks.index.get, { taskId: f.taskId })).updatedAt).toBe(before.updatedAt);
  await expect(
    f.owner.query(api.tasks.reactions.list, { taskId: f.taskId, paginationOpts: { cursor: null, numItems: 101 } })
  ).rejects.toThrow();
});
test("link writer permission differs from reaction permission and all metadata edits preserve actor/scope", async () => {
  const f = await fixture();
  const member = await person(f, "member");
  const guest = await person(f, "guest");
  await f.owner.mutation(api.intakes.index.configure, {
    projectId: f.projectId,
    expectedRevision: 0,
    enabled: false,
    guestViewAllFeatures: true,
  });
  const linkId = await f.owner.mutation(api.tasks.links.create, {
    taskId: f.taskId,
    url: "example.com/a",
    title: null,
    metadata: { source: "manual" },
  });
  let link = await member.user.query(api.tasks.links.get, { taskId: f.taskId, linkId });
  expect(link.url).toBe("http://example.com/a");
  expect(link.title).toBeNull();
  await member.user.mutation(api.tasks.links.update, {
    taskId: f.taskId,
    linkId,
    expectedUpdatedAt: link.updatedAt,
    title: "Updated",
  });
  link = await f.owner.query(api.tasks.links.get, { taskId: f.taskId, linkId });
  expect(link.metadata).toEqual({ source: "manual" });
  expect(link.createdBy).toBe(f.userId);
  expect(link.updatedBy).toBe(member.userId);
  expect((await guest.user.query(api.tasks.links.access, { taskId: f.taskId })).canWrite).toBe(false);
  expect(
    (await guest.user.query(api.tasks.links.list, { taskId: f.taskId, deleted: false, paginationOpts })).page
  ).toHaveLength(1);
  await expect(
    guest.user.mutation(api.tasks.links.update, {
      taskId: f.taskId,
      linkId,
      expectedUpdatedAt: link.updatedAt,
      title: "No",
    })
  ).rejects.toThrow("access");
  const other = await f.owner.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Other" });
  await expect(f.owner.query(api.tasks.links.get, { taskId: other, linkId })).rejects.toThrow("not found");
});
test("link uniqueness covers create, update and restore; rejected operations preserve task revision", async () => {
  const f = await fixture();
  const linkId = await f.owner.mutation(api.tasks.links.create, { taskId: f.taskId, url: "https://example.com" });
  await expect(
    f.owner.mutation(api.tasks.links.create, { taskId: f.taskId, url: "https://example.com" })
  ).rejects.toThrow("already exists");
  const second = await f.owner.mutation(api.tasks.links.create, { taskId: f.taskId, url: "https://example.com/other" });
  let row = await f.owner.query(api.tasks.links.get, { taskId: f.taskId, linkId: second });
  await expect(
    f.owner.mutation(api.tasks.links.update, {
      taskId: f.taskId,
      linkId: second,
      expectedUpdatedAt: row.updatedAt,
      url: "https://example.com",
    })
  ).rejects.toThrow("already exists");
  row = await f.owner.query(api.tasks.links.get, { taskId: f.taskId, linkId });
  await f.owner.mutation(api.tasks.links.lifecycle, {
    taskId: f.taskId,
    linkId,
    expectedUpdatedAt: row.updatedAt,
    deleted: true,
  });
  await f.owner.mutation(api.tasks.links.create, { taskId: f.taskId, url: "https://example.com" });
  row = await f.owner.query(api.tasks.links.get, { taskId: f.taskId, linkId });
  const before = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
  await expect(
    f.owner.mutation(api.tasks.links.lifecycle, {
      taskId: f.taskId,
      linkId,
      expectedUpdatedAt: row.updatedAt,
      deleted: false,
    })
  ).rejects.toThrow("already exists");
  expect((await f.owner.query(api.tasks.index.get, { taskId: f.taskId })).updatedAt).toBe(before.updatedAt);
});
test("link same-clock CAS and recovery retain original metadata; task archive/delete blocks writes and read leaks", async () => {
  vi.useFakeTimers();
  try {
    const f = await fixture();
    const linkId = await f.owner.mutation(api.tasks.links.create, {
      taskId: f.taskId,
      url: "https://example.com",
      metadata: { label: "preserve" },
    });
    let row = await f.owner.query(api.tasks.links.get, { taskId: f.taskId, linkId });
    const args = { taskId: f.taskId, linkId, expectedUpdatedAt: row.updatedAt };
    await f.owner.mutation(api.tasks.links.update, { ...args, title: "New" });
    await expect(f.owner.mutation(api.tasks.links.lifecycle, { ...args, deleted: true })).rejects.toThrow("changed");
    row = await f.owner.query(api.tasks.links.get, { taskId: f.taskId, linkId });
    await f.owner.mutation(api.tasks.links.lifecycle, { ...args, expectedUpdatedAt: row.updatedAt, deleted: true });
    row = await f.owner.query(api.tasks.links.get, { taskId: f.taskId, linkId });
    await f.owner.mutation(api.tasks.links.lifecycle, { ...args, expectedUpdatedAt: row.updatedAt, deleted: false });
    expect((await f.owner.query(api.tasks.links.get, { taskId: f.taskId, linkId })).metadata).toEqual({
      label: "preserve",
    });
    await f.owner.mutation(api.tasks.index.setStatus, { taskId: f.taskId, status: "done" });
    let task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
    await f.owner.mutation(api.tasks.lifecycle.change, {
      taskId: f.taskId,
      expectedUpdatedAt: task.updatedAt,
      operation: "archive",
    });
    expect((await f.owner.query(api.tasks.links.access, { taskId: f.taskId })).canWrite).toBe(false);
    await expect(
      f.owner.mutation(api.tasks.links.create, { taskId: f.taskId, url: "https://example.org" })
    ).rejects.toThrow("not found");
    task = await f.owner.query(api.tasks.index.get, { taskId: f.taskId });
    await f.owner.mutation(api.tasks.lifecycle.change, {
      taskId: f.taskId,
      expectedUpdatedAt: task.updatedAt,
      operation: "delete",
    });
    await expect(f.owner.query(api.tasks.links.get, { taskId: f.taskId, linkId })).rejects.toThrow("not found");
  } finally {
    vi.useRealTimers();
  }
});

test("DEL/C1 reaction controls are rejected and removed link metadata is writer-only", async () => {
  const f = await fixture();
  const guest = await person(f, "guest");
  await f.owner.mutation(api.intakes.index.configure, {
    projectId: f.projectId,
    expectedRevision: 0,
    enabled: false,
    guestViewAllFeatures: true,
  });
  await Promise.all(
    [127, 128, 159].map(async (point) => {
      await expect(
        f.owner.mutation(api.tasks.reactions.set, { taskId: f.taskId, reaction: String(point), active: true })
      ).rejects.toThrow("Unicode");
    })
  );
  const linkId = await f.owner.mutation(api.tasks.links.create, {
    taskId: f.taskId,
    url: "https://example.com/private-removed",
  });
  const link = await f.owner.query(api.tasks.links.get, { taskId: f.taskId, linkId });
  await f.owner.mutation(api.tasks.links.lifecycle, {
    taskId: f.taskId,
    linkId,
    expectedUpdatedAt: link.updatedAt,
    deleted: true,
  });
  await expect(guest.user.query(api.tasks.links.get, { taskId: f.taskId, linkId })).rejects.toThrow("access");
  await expect(
    guest.user.query(api.tasks.links.list, { taskId: f.taskId, deleted: true, paginationOpts })
  ).rejects.toThrow("access");
  expect(
    (await guest.user.query(api.tasks.links.list, { taskId: f.taskId, deleted: false, paginationOpts })).page
  ).toEqual([]);
  expect(
    (await f.owner.query(api.tasks.links.list, { taskId: f.taskId, deleted: true, paginationOpts })).page
  ).toHaveLength(1);
});
