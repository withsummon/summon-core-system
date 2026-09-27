import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { signedIn } from "../../../test-support/session";
let link: URL;
beforeEach(() => {
  vi.stubEnv("AUTH_RESEND_KEY", "fixture");
  vi.stubEnv("EMAIL_FROM", "fixture@example.test");
  vi.stubEnv("SITE_URL", "https://summon.example.test");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      const address = body.text.split("\n\n")[2];
      link = new URL(address);
      return new Response("{}", { status: 200 });
    })
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function sent() {
  const f = await workspaceJourney();
  const result = await f.owner.action(api.invitations.email.send, {
    workspaceId: f.workspaceId,
    projectId: null,
    email: "invited@example.test",
    role: "member",
  });
  const token = link.searchParams.get("token")!;
  return { ...f, ...result, token };
}
test("email delivery emits actual recipient link; token-bound preview and verified acceptance reuse canonical owners", async () => {
  const f = await sent();
  expect(f.delivery).toBe("sent");
  expect(link.origin).toBe("https://summon.example.test");
  expect(link.pathname).toBe("/workspace-invitations/");
  expect(link.searchParams.get("invitation_id")).toBe(f.invitationId);
  const preview = await f.t.action(api.invitations.email.preview, { invitationId: f.invitationId, token: f.token });
  expect(preview).toMatchObject({
    email: "invited@example.test",
    workspace: { name: "Workspace", slug: "workspace" },
    logo: null,
  });
  expect(new Set(Object.keys(preview))).toEqual(
    new Set(["email", "expiresAt", "id", "logo", "project", "role", "workspace"])
  );
  const userId = await f.t.run((ctx) =>
    ctx.db.insert("users", { email: "invited@example.test", emailVerificationTime: Date.now() })
  );
  const recipient = await signedIn(f.t, userId);
  expect(
    await recipient.action(api.invitations.tokens.respond, {
      invitationId: f.invitationId,
      token: f.token,
      accepted: true,
    })
  ).toMatchObject({ accepted: true, workspaceId: f.workspaceId });
  await expect(
    f.t.action(api.invitations.email.preview, { invitationId: f.invitationId, token: f.token })
  ).rejects.toThrow("unavailable");
});
test("delivery failure is persisted; resend rotates the old token and does not return manual acceptance tokens", async () => {
  const f = await workspaceJourney();
  vi.mocked(fetch).mockResolvedValueOnce(new Response("failed", { status: 503 }));
  const result = await f.owner.action(api.invitations.email.send, {
    workspaceId: f.workspaceId,
    projectId: null,
    email: "invited@example.test",
    role: "member",
  });
  expect(result.delivery).toBe("failed");
  expect(new Set(Object.keys(result))).toEqual(new Set(["invitationId", "delivery"]));
  expect(await f.t.run((ctx) => ctx.db.get(result.invitationId))).toMatchObject({
    delivery: { status: "failed", revision: 0 },
  });
  await f.owner.action(api.invitations.email.resend, { invitationId: result.invitationId, expectedRevision: 0 });
  const first = link.searchParams.get("token")!;
  await f.owner.action(api.invitations.email.resend, { invitationId: result.invitationId, expectedRevision: 1 });
  await expect(
    f.t.action(api.invitations.email.preview, { invitationId: result.invitationId, token: first })
  ).rejects.toThrow("unavailable");
});
test.each(["expired", "restricted", "revoked"])(
  "%s invitation cannot preview private workspace metadata",
  async (kind) => {
    const f = await sent();
    await f.t.run(async (ctx) => {
      if (kind === "expired") await ctx.db.patch(f.invitationId, { expiresAt: Date.now() - 1 });
      else if (kind === "restricted")
        await ctx.db.insert("accountRestrictions", { userId: f.userId, deactivatedAt: Date.now() });
      else await ctx.db.patch(f.invitationId, { status: "revoked" });
    });
    await expect(
      f.t.action(api.invitations.email.preview, { invitationId: f.invitationId, token: f.token })
    ).rejects.toThrow();
  }
);
test("unconfigured delivery creates no reservation and never calls Resend", async () => {
  const f = await workspaceJourney();
  vi.stubEnv("AUTH_RESEND_KEY", "");
  await expect(
    f.owner.action(api.invitations.email.send, {
      workspaceId: f.workspaceId,
      projectId: null,
      email: "invited@example.test",
      role: "member",
    })
  ).rejects.toThrow("not configured");
  expect(await f.t.run((ctx) => ctx.db.query("invitations").collect())).toHaveLength(0);
  expect(fetch).not.toHaveBeenCalled();
});

test.each(["read", "revoke", "rotate"])(
  "token-bound logo %s rechecks current invitation after reading bytes",
  async (change) => {
    const f = await sent();
    const bytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6sQAAAABJRU5ErkJggg==",
      "base64"
    );
    const ticket = await f.owner.mutation(api.settings.logo.prepare, {
      workspaceId: f.workspaceId,
      expectedRevision: 0,
      name: "logo.png",
      contentType: "image/png",
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("base64"),
    });
    const storageId = await f.t.run((ctx) => ctx.storage.store(new Blob([bytes], { type: "image/png" })));
    await f.owner.action(api.assets.upload.finalize, { assetId: ticket.assetId, storageId });
    const original = Blob.prototype.arrayBuffer;
    vi.spyOn(Blob.prototype, "arrayBuffer").mockImplementationOnce(async function (this: Blob) {
      const content = await original.call(this);
      if (change === "revoke")
        await f.owner.mutation(api.invitations.index.revoke, { invitationId: f.invitationId, expectedRevision: 0 });
      if (change === "rotate")
        await f.owner.action(api.invitations.tokens.rotate, { invitationId: f.invitationId, expectedRevision: 0 });
      return content;
    });
    const result = f.t.action(api.invitations.email.preview, { invitationId: f.invitationId, token: f.token });
    if (change === "read") {
      const preview = await result;
      expect(preview.logo?.contentType).toBe("image/png");
      expect(Buffer.from(preview.logo!.bytes)).toEqual(bytes);
      expect(new Set(Object.keys(preview.logo!))).toEqual(new Set(["contentType", "bytes"]));
      expect((await f.t.fetch(`/assets/${ticket.assetId}`)).status).toBe(401);
    } else await expect(result).rejects.toThrow("unavailable");
  }
);

test("recipient inbox accepts without pasted tokens; wrong recipient and stale selection cannot grant", async () => {
  const f = await sent();
  const userId = await f.t.run((ctx) =>
    ctx.db.insert("users", { email: "invited@example.test", emailVerificationTime: Date.now() })
  );
  const actor = await signedIn(f.t, userId);
  expect(await actor.action(api.invitations.email.incomingPreview, { invitationId: f.invitationId })).toMatchObject({
    email: "invited@example.test",
    workspace: { id: f.workspaceId },
  });
  await expect(
    f.owner.action(api.invitations.email.incomingPreview, { invitationId: f.invitationId })
  ).rejects.toThrow();
  await f.owner.action(api.invitations.tokens.rotate, { invitationId: f.invitationId, expectedRevision: 0 });
  await expect(
    actor.mutation(api.invitations.index.respondIncoming, {
      invitationId: f.invitationId,
      expectedRevision: 0,
      accepted: true,
    })
  ).rejects.toThrow("changed");
  expect(
    await actor.mutation(api.invitations.index.acceptIncoming, {
      invitations: [{ invitationId: f.invitationId, expectedRevision: 1 }],
    })
  ).toMatchObject([{ accepted: true, workspaceId: f.workspaceId }]);
});
test("bulk inbox acceptance rolls back earlier grants when a later selection is stale", async () => {
  const f = await sent();
  const second = await f.owner.action(api.invitations.email.send, {
    workspaceId: f.workspaceId,
    projectId: f.projectId,
    email: "invited@example.test",
    role: "member",
  });
  const userId = await f.t.run((ctx) =>
    ctx.db.insert("users", { email: "invited@example.test", emailVerificationTime: Date.now() })
  );
  const actor = await signedIn(f.t, userId);
  await expect(
    actor.mutation(api.invitations.index.acceptIncoming, {
      invitations: [
        { invitationId: f.invitationId, expectedRevision: 0 },
        { invitationId: second.invitationId, expectedRevision: 1 },
      ],
    })
  ).rejects.toThrow("changed");
  expect(await f.t.run((ctx) => ctx.db.get(f.invitationId))).toMatchObject({ status: "pending" });
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace_user", (q) => q.eq("workspaceId", f.workspaceId).eq("userId", userId))
        .unique()
    )
  ).toBeNull();
  expect(
    (await actor.query(api.invitations.index.incoming, { paginationOpts: { cursor: null, numItems: 10 } })).page
  ).toHaveLength(2);
  await f.t.run((ctx) => ctx.db.insert("accountRestrictions", { userId: f.userId, deactivatedAt: Date.now() }));
  expect(
    (await actor.query(api.invitations.index.incoming, { paginationOpts: { cursor: null, numItems: 10 } })).page
  ).toHaveLength(0);
  await expect(
    actor.mutation(api.invitations.index.respondIncoming, {
      invitationId: f.invitationId,
      expectedRevision: 0,
      accepted: true,
    })
  ).rejects.toThrow();
});
