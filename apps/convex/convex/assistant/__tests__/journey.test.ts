import { describe, expect, test } from "vitest";
import { api, internal } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
async function journey() {
  const base = await workspaceJourney();
  const conversationId = await base.owner.mutation(api.assistant.index.save, {
    workspaceId: base.workspaceId,
    title: "Delivery assistant",
    context: { projectId: base.projectId, clientId: null, meetingId: null, documentIds: [] },
  });
  return { ...base, conversationId };
}
const page = { numItems: 20, cursor: null };
describe("assistant ownership and reply lifecycle", () => {
  test("only owner can read conversation, messages or list entries", async () => {
    const { t, owner, workspaceId, conversationId } = await journey();
    const strangerId = await t.run((ctx) => ctx.db.insert("users", { name: "Stranger" }));
    await t.run((ctx) =>
      ctx.db.insert("workspaceMembers", { workspaceId, userId: strangerId, role: "member", active: true })
    );
    const stranger = t.withIdentity({ subject: strangerId });
    await expect(stranger.query(api.assistant.index.get, { conversationId })).rejects.toThrow("access denied");
    await expect(
      stranger.query(api.assistant.index.messages, { conversationId, paginationOpts: page })
    ).rejects.toThrow("access denied");
    expect((await stranger.query(api.assistant.index.list, { workspaceId, paginationOpts: page })).page).toEqual([]);
    expect((await owner.query(api.assistant.index.list, { workspaceId, paginationOpts: page })).page).toHaveLength(1);
  });
  test("accepted request persists once, overlapping or duplicate requests never generate twice, cancellation rejects late output", async () => {
    const { owner, conversationId } = await journey();
    const args = {
      conversationId,
      requestId: "request-0001",
      content: "What is this project?",
      provider: "openai",
      model: "test-model",
    };
    const { messageId } = await owner.mutation(internal.assistant.messages.begin, args);
    await expect(owner.mutation(internal.assistant.messages.begin, args)).rejects.toThrow("already accepted");
    await expect(
      owner.mutation(internal.assistant.messages.begin, { ...args, requestId: "request-0002" })
    ).rejects.toThrow("already in progress");
    await owner.mutation(internal.assistant.messages.publish, { messageId, chunk: "Delivery", complete: false });
    await owner.mutation(api.assistant.index.cancelReply, { conversationId });
    await expect(
      owner.mutation(internal.assistant.messages.publish, { messageId, chunk: " late", complete: true })
    ).rejects.toThrow("no longer active");
    const messages = await owner.query(api.assistant.index.messages, { conversationId, paginationOpts: page });
    expect(messages.page).toHaveLength(2);
    expect(messages.page.find((m) => m.role === "assistant")).toMatchObject({
      content: "Delivery",
      status: "cancelled",
    });
  });
  test("post-provider authorization rejects both streamed and final output after project membership revocation", async () => {
    const { t, owner, userId, projectId, conversationId } = await journey();
    const { messageId } = await owner.mutation(internal.assistant.messages.begin, {
      conversationId,
      requestId: "request-0001",
      content: "Summarize",
      provider: "openai",
      model: "test",
    });
    await t.run(async (ctx) => {
      const member = await ctx.db
        .query("projectMembers")
        .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", userId))
        .unique();
      if (member) await ctx.db.patch(member._id, { active: false });
    });
    await expect(
      owner.mutation(internal.assistant.messages.publish, { messageId, chunk: "secret", complete: false })
    ).rejects.toThrow();
    await expect(
      owner.mutation(internal.assistant.messages.publish, { messageId, chunk: "secret", complete: true })
    ).rejects.toThrow();
    await owner.mutation(internal.assistant.messages.fail, { messageId });
    expect(await t.run((ctx) => ctx.db.get(messageId))).toMatchObject({ content: "", status: "failed" });
    expect((await owner.query(api.assistant.index.get, { conversationId })).activeMessageId).toBeNull();
  });
});
describe("explicit assistant action approval", () => {
  test("proposal makes no task write; confirmation atomically executes once through task owner", async () => {
    const { t, owner, projectId, conversationId } = await journey();
    const taskId = await owner.mutation(api.tasks.index.create, { projectId, title: "Approve release" });
    const actionId = await owner.mutation(api.assistant.actions.propose, {
      conversationId,
      taskId,
      nextStatus: "done",
    });
    expect((await owner.query(api.tasks.index.get, { taskId })).status).toBe("todo");
    await owner.mutation(api.assistant.actions.confirm, { actionId });
    await owner.mutation(api.assistant.actions.confirm, { actionId });
    expect((await owner.query(api.tasks.index.get, { taskId })).status).toBe("done");
    expect(
      (await t.run((ctx) => ctx.db.query("taskEvents").collect())).filter(
        (e) => e.taskId === taskId && e.kind === "status_changed"
      )
    ).toHaveLength(1);
  });
  test("changed task makes approval stale and cancelled actions cannot execute", async () => {
    const { owner, projectId, conversationId } = await journey();
    const taskId = await owner.mutation(api.tasks.index.create, { projectId, title: "Release" });
    const actionId = await owner.mutation(api.assistant.actions.propose, {
      conversationId,
      taskId,
      nextStatus: "done",
    });
    await owner.mutation(api.tasks.index.setStatus, { taskId, status: "in_progress" });
    await expect(owner.mutation(api.assistant.actions.confirm, { actionId })).rejects.toThrow("Task changed");
    await owner.mutation(api.assistant.actions.cancel, { actionId });
    await expect(owner.mutation(api.assistant.actions.confirm, { actionId })).rejects.toThrow("no longer pending");
    expect((await owner.query(api.tasks.index.get, { taskId })).status).toBe("in_progress");
  });
});

test("changing conversation project invalidates an earlier action preview", async () => {
  const { owner, workspaceId, projectId, conversationId } = await journey();
  const taskId = await owner.mutation(api.tasks.index.create, { projectId, title: "Original project" });
  const actionId = await owner.mutation(api.assistant.actions.propose, { conversationId, taskId, nextStatus: "done" });
  const secondProject = await owner.mutation(api.projects.index.create, {
    workspaceId,
    name: "Other",
    identifier: "OTH",
  });
  await owner.mutation(api.assistant.index.save, {
    workspaceId,
    conversationId,
    title: "Changed context",
    context: { projectId: secondProject, clientId: null, meetingId: null, documentIds: [] },
  });
  await expect(owner.mutation(api.assistant.actions.confirm, { actionId })).rejects.toThrow(
    "outside the conversation context"
  );
  expect((await owner.query(api.tasks.index.get, { taskId })).status).toBe("todo");
});
test("message history retains its source context and cannot be reprompted under another context", async () => {
  const { owner, workspaceId, conversationId } = await journey();
  const { messageId } = await owner.mutation(internal.assistant.messages.begin, {
    conversationId,
    requestId: "request-0001",
    content: "Summarize",
    provider: "openai",
    model: "test",
  });
  await owner.mutation(internal.assistant.messages.publish, { messageId, chunk: "Summary", complete: true });
  await expect(
    owner.mutation(api.assistant.index.save, {
      workspaceId,
      conversationId,
      title: "Move context",
      context: { projectId: null, clientId: null, meetingId: null, documentIds: [] },
    })
  ).rejects.toThrow("Start a new conversation");
});
test("document deletion after provider start blocks publication and historical message reads", async () => {
  const { t, owner, workspaceId, projectId, conversationId } = await journey();
  const documentId = await owner.mutation(api.documents.index.create, {
    workspaceId,
    projectIds: [projectId],
    name: "Source",
    access: "public",
    isGlobal: false,
    color: "",
    viewProps: {},
    logoProps: {},
    sortOrder: 0,
    category: "",
    tags: [],
    clientId: null,
    opportunityId: null,
    externalId: "",
    externalSource: "",
  });
  await owner.mutation(api.assistant.index.save, {
    workspaceId,
    conversationId,
    title: "Document assistant",
    context: { projectId, clientId: null, meetingId: null, documentIds: [documentId] },
  });
  const { messageId } = await owner.mutation(internal.assistant.messages.begin, {
    conversationId,
    requestId: "request-0001",
    content: "Read source",
    provider: "openai",
    model: "test",
  });
  await owner.mutation(api.documents.index.setLifecycle, {
    expectedUpdatedAt: (await owner.query(api.documents.index.get, { documentId })).updatedAt,
    documentId,
    isLocked: false,
    archived: false,
    deleted: true,
  });
  await expect(
    owner.mutation(internal.assistant.messages.publish, { messageId, chunk: "Deleted source", complete: true })
  ).rejects.toThrow();
  await expect(owner.query(api.assistant.index.messages, { conversationId, paginationOpts: page })).rejects.toThrow();
  expect(await t.run((ctx) => ctx.db.get(messageId))).toMatchObject({ content: "", status: "streaming" });
  await owner.mutation(internal.assistant.messages.fail, { messageId });
});

test("revoked task access blocks action preview reads and confirmation", async () => {
  const { t, owner, projectId, userId, conversationId } = await journey();
  const taskId = await owner.mutation(api.tasks.index.create, { projectId, title: "Restricted task" });
  const actionId = await owner.mutation(api.assistant.actions.propose, { conversationId, taskId, nextStatus: "done" });
  await t.run(async (ctx) => {
    const member = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", userId))
      .unique();
    if (member) await ctx.db.patch(member._id, { active: false });
  });
  await expect(owner.query(api.assistant.actions.get, { actionId })).rejects.toThrow();
  await expect(owner.query(api.assistant.actions.list, { conversationId, paginationOpts: page })).rejects.toThrow();
  await expect(owner.mutation(api.assistant.actions.confirm, { actionId })).rejects.toThrow();
  expect(await t.run((ctx) => ctx.db.get(taskId))).toMatchObject({ status: "todo" });
});
