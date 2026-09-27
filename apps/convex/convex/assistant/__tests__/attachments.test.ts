import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import { api, internal } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
async function fixture() {
  const base = await workspaceJourney();
  const conversationId = await base.owner.mutation(api.assistant.index.save, {
    workspaceId: base.workspaceId,
    title: "Files",
    context: { projectId: base.projectId, clientId: null, meetingId: null, documentIds: [] },
  });
  return { ...base, conversationId };
}
async function upload(f: Awaited<ReturnType<typeof fixture>>, content = "Important quarterly text") {
  const file = {
    name: "notes.txt",
    contentType: "text/plain",
    size: Buffer.byteLength(content),
    sha256: createHash("sha256").update(content).digest("base64"),
  };
  const ticket = await f.owner.mutation(api.assistant.attachments.prepare, {
    conversationId: f.conversationId,
    ...file,
  });
  const storageId = await f.t.run((ctx) => ctx.storage.store(new Blob([content], { type: file.contentType })));
  return { ...ticket, storageId, file };
}
const message = { requestId: "attachment-request-1", content: "Summarize the file", provider: "test", model: "test" };
test("text attachment extraction and authenticated download remain private to its conversation owner", async () => {
  const f = await fixture();
  const file = await upload(f);
  await f.owner.action(api.assistant.attachment_upload.finalize, {
    attachmentId: file.attachmentId,
    storageId: file.storageId,
  });
  expect(await f.owner.query(api.assistant.attachments.pending, { conversationId: f.conversationId })).toMatchObject([
    { name: "notes.txt", status: "ready" },
  ]);
  expect(
    (await f.owner.query(api.assistant.attachments.pending, { conversationId: f.conversationId }))[0]
  ).not.toHaveProperty("text");
  const peerId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Peer" }));
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: peerId,
    role: "member",
  });
  await f.owner.mutation(api.projects.index.grantMember, { projectId: f.projectId, userId: peerId, role: "member" });
  const peer = f.t.withIdentity({ subject: peerId });
  await expect(peer.query(api.assistant.attachments.pending, { conversationId: f.conversationId })).rejects.toThrow(
    "access"
  );
  await expect(peer.query(api.assets.index.get, { assetId: file.assetId })).rejects.toThrow("access");
  expect((await peer.fetch(`/assets/${file.assetId}`)).status).toBe(403);
  expect(await (await f.owner.fetch(`/assets/${file.assetId}`)).text()).toBe("Important quarterly text");
  await expect(f.owner.mutation(api.assets.index.remove, { assetId: file.assetId })).rejects.toThrow(
    "assistant attachments"
  );
});
test("ready files bind atomically once, become bounded context, and cannot be removed after acceptance", async () => {
  const f = await fixture();
  const file = await upload(f, "A".repeat(31000));
  await f.owner.action(api.assistant.attachment_upload.finalize, {
    attachmentId: file.attachmentId,
    storageId: file.storageId,
  });
  const started = await f.owner.mutation(internal.assistant.messages.begin, {
    ...message,
    conversationId: f.conversationId,
    attachmentIds: [file.attachmentId],
  });
  expect(
    await f.owner.mutation(internal.assistant.messages.begin, {
      ...message,
      conversationId: f.conversationId,
      attachmentIds: [file.attachmentId],
    })
  ).toMatchObject({ messageId: started.messageId, alreadyAccepted: true });
  await expect(
    f.owner.mutation(internal.assistant.messages.begin, {
      ...message,
      content: "Different message",
      conversationId: f.conversationId,
      attachmentIds: [file.attachmentId],
    })
  ).rejects.toThrow("different message inputs");
  await expect(
    f.owner.mutation(internal.assistant.messages.begin, {
      ...message,
      conversationId: f.conversationId,
      attachmentIds: [],
    })
  ).rejects.toThrow("different message inputs");
  expect(started.context).toContain("[Attached file: notes.txt]");
  expect(started.context.length).toBeLessThanOrEqual(30000);
  expect(await f.owner.query(api.assistant.attachments.pending, { conversationId: f.conversationId })).toEqual([]);
  const stored = await f.t.run((ctx) => ctx.db.get(file.attachmentId));
  expect(stored?.messageId).not.toBeNull();
  await expect(f.owner.mutation(api.assistant.attachments.remove, { attachmentId: file.attachmentId })).rejects.toThrow(
    "already attached"
  );
  await f.owner.mutation(api.assistant.index.cancelReply, { conversationId: f.conversationId });
  await expect(
    f.owner.mutation(internal.assistant.messages.begin, {
      ...message,
      requestId: "attachment-request-2",
      conversationId: f.conversationId,
      attachmentIds: [file.attachmentId],
    })
  ).rejects.toThrow("unbound");
  const history = await f.owner.query(api.assistant.index.messages, {
    conversationId: f.conversationId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(history.page.find((row) => row._id === started.messageId)?.contextTruncated).toBe(true);
});
test("five upload slots are transactionally bounded and removal permits another upload", async () => {
  const f = await fixture();
  const outcomes = await Promise.allSettled(Array.from({ length: 6 }, () => upload(f)));
  expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(5);
  const pending = await f.owner.query(api.assistant.attachments.pending, { conversationId: f.conversationId });
  await f.owner.mutation(api.assistant.attachments.remove, { attachmentId: pending[0]._id });
  await expect(upload(f)).resolves.toHaveProperty("attachmentId");
});
test("wrong MIME, binary UTF8 and blank text never become ready sources", async () => {
  const f = await fixture();
  await expect(
    f.owner.mutation(api.assistant.attachments.prepare, {
      conversationId: f.conversationId,
      name: "notes.pdf",
      contentType: "application/pdf",
      size: 5,
      sha256: "A".repeat(43) + "=",
    })
  ).rejects.toThrow("TXT");
  await Promise.all(
    ["\0binary", "   "].map(async (text) => {
      const file = await upload(f, text);
      await expect(
        f.owner.action(api.assistant.attachment_upload.finalize, {
          attachmentId: file.attachmentId,
          storageId: file.storageId,
        })
      ).rejects.toThrow();
      expect((await f.t.run((ctx) => ctx.db.get(file.attachmentId)))?.status).toBe("failed");
    })
  );
});
test("another conversation cannot bind or download the file and pending uploads cannot be submitted", async () => {
  const f = await fixture();
  const file = await upload(f);
  await expect(
    f.owner.mutation(internal.assistant.messages.begin, {
      ...message,
      conversationId: f.conversationId,
      attachmentIds: [file.attachmentId],
    })
  ).rejects.toThrow("ready");
  await f.owner.action(api.assistant.attachment_upload.finalize, {
    attachmentId: file.attachmentId,
    storageId: file.storageId,
  });
  const otherId = await f.owner.mutation(api.assistant.index.save, {
    workspaceId: f.workspaceId,
    title: "Other",
    context: { projectId: null, clientId: null, meetingId: null, documentIds: [] },
  });
  await expect(
    f.owner.mutation(internal.assistant.messages.begin, {
      ...message,
      conversationId: otherId,
      attachmentIds: [file.attachmentId],
    })
  ).rejects.toThrow("conversation");
  await expect(
    f.owner.query(api.assistant.attachments.download, { conversationId: otherId, attachmentId: file.attachmentId })
  ).rejects.toThrow("unavailable");
});
test("unconfigured provider leaves selected ready uploads unbound and a deleted conversation withholds bytes", async () => {
  const f = await fixture();
  const file = await upload(f);
  await f.owner.action(api.assistant.attachment_upload.finalize, {
    attachmentId: file.attachmentId,
    storageId: file.storageId,
  });
  const response = await f.owner.fetch("/assistant/reply", {
    method: "POST",
    body: JSON.stringify({
      conversationId: f.conversationId,
      requestId: "http-attachment-1",
      content: "Read this",
      attachmentIds: [file.attachmentId],
    }),
  });
  expect(response.status).toBe(503);
  expect((await f.t.run((ctx) => ctx.db.get(file.attachmentId)))?.messageId).toBeNull();
  await f.owner.mutation(api.assistant.index.remove, { conversationId: f.conversationId });
  expect((await f.owner.fetch(`/assets/${file.assetId}`)).status).toBe(403);
  await f.owner.mutation(internal.assistant.attachments.purgeConversation, {
    conversationId: f.conversationId,
    cursor: null,
  });
  expect((await f.t.run((ctx) => ctx.db.get(file.assetId)))?.status).toBe("deleted");
});

test("context permission revocation withholds previously uploaded bytes and prevents attachment binding", async () => {
  const f = await fixture();
  const file = await upload(f);
  await f.owner.action(api.assistant.attachment_upload.finalize, {
    attachmentId: file.attachmentId,
    storageId: file.storageId,
  });
  const successorId = await f.t.run((ctx) => ctx.db.insert("users", { name: "Successor" }));
  await f.owner.mutation(api.workspaces.index.grantMember, {
    workspaceId: f.workspaceId,
    userId: successorId,
    role: "member",
  });
  await f.owner.mutation(api.projects.index.grantMember, {
    projectId: f.projectId,
    userId: successorId,
    role: "admin",
  });
  await f.owner.mutation(api.projects.index.revokeMember, { projectId: f.projectId, userId: f.userId });
  await expect(f.owner.query(api.assistant.attachments.pending, { conversationId: f.conversationId })).rejects.toThrow(
    "access"
  );
  expect((await f.owner.fetch(`/assets/${file.assetId}`)).status).toBe(403);
  await expect(
    f.owner.mutation(internal.assistant.messages.begin, {
      ...message,
      conversationId: f.conversationId,
      attachmentIds: [file.attachmentId],
    })
  ).rejects.toThrow("access");
  expect((await f.t.run((ctx) => ctx.db.get(file.attachmentId)))?.messageId).toBeNull();
});
