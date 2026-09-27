import { expect, test } from "vitest";
import { api, internal } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
test("a revoked JWT subject immediately loses ordinary reads, writes and pending assistant publication", async () => {
  const f = await workspaceJourney();
  const sessionId = await f.t.run((ctx) =>
    ctx.db.insert("authSessions", { userId: f.userId, expirationTime: Date.now() + 60000 })
  );
  const actor = f.t.withIdentity({ subject: `${f.userId}|${sessionId}` });
  const taskId = await actor.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Session guarded" });
  const conversationId = await actor.mutation(api.assistant.index.save, {
    workspaceId: f.workspaceId,
    title: "Session test",
    context: { projectId: f.projectId, clientId: null, meetingId: null, documentIds: [] },
  });
  const started = await actor.mutation(internal.assistant.messages.begin, {
    conversationId,
    requestId: "session-test-01",
    content: "Test",
    attachmentIds: [],
    provider: "fixture",
    model: "fixture",
  });
  expect(await actor.query(api.identity.session.status, {})).toMatchObject({ valid: true });
  await f.owner.mutation(api.sessions.index.revoke, { sessionId });
  expect(await actor.query(api.identity.session.status, {})).toEqual({ valid: false });
  expect((await actor.fetch("/assets/not-an-asset")).status).toBe(401);
  expect((await actor.fetch("/assistant/reply", { method: "POST", body: "{}" })).status).toBe(401);
  await expect(actor.query(api.tasks.index.get, { taskId })).rejects.toThrow("SESSION_EXPIRED");
  await expect(actor.query(api.identity.profile.get, {})).rejects.toThrow("SESSION_EXPIRED");
  await expect(
    actor.mutation(api.tasks.index.create, { projectId: f.projectId, title: "Must not exist" })
  ).rejects.toThrow("SESSION_EXPIRED");
  await expect(
    actor.mutation(internal.assistant.messages.publish, {
      messageId: started.messageId,
      chunk: "Must not persist",
      complete: true,
    })
  ).rejects.toThrow("SESSION_EXPIRED");
  expect(await f.owner.query(api.tasks.index.get, { taskId })).toMatchObject({ title: "Session guarded" });
});
test("sessionless identity has no production bypass and expiry is checked on ordinary calls", async () => {
  const f = await workspaceJourney();
  const sessionless = f.t.withIdentity({ subject: f.userId });
  expect(await sessionless.query(api.identity.session.status, {})).toEqual({ valid: false });
  await expect(sessionless.query(api.workspaces.index.list, {})).rejects.toThrow("SESSION_EXPIRED");
  const sessionId = await f.t.run((ctx) =>
    ctx.db.insert("authSessions", { userId: f.userId, expirationTime: Date.now() - 1 })
  );
  const expired = f.t.withIdentity({ subject: `${f.userId}|${sessionId}` });
  expect(await expired.query(api.identity.session.status, {})).toEqual({ valid: false });
  await expect(expired.mutation(api.workspaces.index.create, { name: "No", slug: "no-session" })).rejects.toThrow(
    "SESSION_EXPIRED"
  );
});
