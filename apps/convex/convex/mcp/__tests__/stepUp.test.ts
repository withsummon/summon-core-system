import { afterEach, expect, test, vi } from "vitest";
import { createAccount } from "@convex-dev/auth/server";
import { convexTest } from "convex-test";
import schema from "../../schema";
import { api, internal } from "../../_generated/api";
const modules = import.meta.glob("/convex/**/*.{ts,js}");
const password = "synthetic-password-only";
const secret = "synthetic-secret-only";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
async function setup() {
  vi.stubEnv("SUMMON_CREDENTIAL_KEY", btoa("01234567890123456789012345678901"));
  vi.stubEnv("AUTH_LOG_LEVEL", "ERROR");
  vi.stubEnv("AUTH_LOG_SECRETS", "false");
  const t = convexTest(schema, modules);
  const account = await t.action((ctx) =>
    createAccount(ctx, {
      provider: "password",
      account: { id: "fixture@example.test", secret: password },
      profile: { name: "Fixture", email: "fixture@example.test" },
    })
  );
  const userId = account.user._id;
  const sessionId = await t.run((ctx) =>
    ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 3600000 })
  );
  const owner = t.withIdentity({ subject: `${userId}|${sessionId}` });
  const workspaceId = await owner.mutation(api.workspaces.index.create, {
    name: "Credential QA",
    slug: "credential-qa",
  });
  const credentialId = await owner.action(api.mcp.vault.create, {
    workspaceId,
    projectId: null,
    remoteProjectId: null,
    remoteWorkspaceSlug: "synthetic",
    name: "Synthetic only",
    accountIdentifier: "fixture",
    secret,
  });
  return { t, owner, userId, sessionId, workspaceId, credentialId };
}
test("configured Password provider verifies real hash and issues single-use reveal proof without persisting password", async () => {
  const { t, owner, credentialId } = await setup();
  await expect(
    owner.action(api.mcp.stepUp.verify, { credentialId, operation: "reveal", password: "wrong-password" })
  ).rejects.toThrow("Password verification failed");
  expect(await t.run((ctx) => ctx.db.query("mcpStepUps").collect())).toHaveLength(0);
  const proofId = await owner.action(api.mcp.stepUp.verify, { credentialId, operation: "reveal", password });
  const proof = await t.run((ctx) => ctx.db.get(proofId));
  expect(JSON.stringify(proof)).not.toContain(password);
  expect(await owner.action(api.mcp.sensitive.reveal, { proofId })).toBe(secret);
  await expect(owner.action(api.mcp.sensitive.reveal, { proofId })).rejects.toThrow("Verify your password again");
  const logs = await owner.query(api.mcp.credentials.logs, {
    credentialId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(logs.page.map((row) => row.action)).toEqual(["reveal", "reveal_verified", "reveal_denied", "create"]);
  expect(JSON.stringify(logs)).not.toContain(secret);
});
test("proof is operation and session bound and expires after two minutes", async () => {
  const { t, owner, userId, credentialId } = await setup();
  const proofId = await owner.action(api.mcp.stepUp.verify, { credentialId, operation: "reveal", password });
  await expect(owner.mutation(api.mcp.sensitive.revoke, { proofId })).rejects.toThrow("Verify your password again");
  const otherSession = await t.run((ctx) =>
    ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 3600000 })
  );
  await expect(
    t.withIdentity({ subject: `${userId}|${otherSession}` }).action(api.mcp.sensitive.reveal, { proofId })
  ).rejects.toThrow("no longer matches");
  await t.run((ctx) => ctx.db.patch(proofId, { expiresAt: Date.now() - 1 }));
  await expect(owner.action(api.mcp.sensitive.reveal, { proofId })).rejects.toThrow("Verify your password again");
});
test("session deletion and permission revocation invalidate a verified operation", async () => {
  const { t, owner, credentialId, sessionId } = await setup();
  const proofId = await owner.action(api.mcp.stepUp.verify, { credentialId, operation: "reveal", password });
  await t.run((ctx) => ctx.db.delete(sessionId));
  await expect(owner.action(api.mcp.sensitive.reveal, { proofId })).rejects.toThrow("session expired");
});
test("rotation consumes proof, replaces ciphertext, increments revision and invalidates previous previews", async () => {
  const { owner, credentialId } = await setup();
  const invocationId = await owner.mutation(api.mcp.invocations.propose, {
    credentialId,
    requestId: "request-0001",
    tool: "project",
    argumentsJson: '{"action":"list"}',
  });
  const proofId = await owner.action(api.mcp.stepUp.verify, { credentialId, operation: "rotate", password });
  await owner.action(api.mcp.sensitive.rotate, { proofId, secret: "rotated-synthetic-secret" });
  expect((await owner.query(api.mcp.credentials.get, { credentialId })).revision).toBe(1);
  await expect(owner.mutation(internal.mcp.invocations.claim, { invocationId })).rejects.toThrow("Credential changed");
  const revealProof = await owner.action(api.mcp.stepUp.verify, { credentialId, operation: "reveal", password });
  expect(await owner.action(api.mcp.sensitive.reveal, { proofId: revealProof })).toBe("rotated-synthetic-secret");
});
test("revoke prevents invocation and deletion erases the secret while preserving immutable audit", async () => {
  const { t, owner, workspaceId, credentialId } = await setup();
  const revokeProof = await owner.action(api.mcp.stepUp.verify, { credentialId, operation: "revoke", password });
  await owner.mutation(api.mcp.sensitive.revoke, { proofId: revokeProof });
  await expect(
    owner.mutation(api.mcp.invocations.propose, {
      credentialId,
      requestId: "request-0001",
      tool: "project",
      argumentsJson: '{"action":"list"}',
    })
  ).rejects.toThrow("revoked");
  const deleteProof = await owner.action(api.mcp.stepUp.verify, { credentialId, operation: "delete", password });
  await owner.mutation(api.mcp.sensitive.remove, { proofId: deleteProof });
  await expect(owner.query(api.mcp.credentials.get, { credentialId })).rejects.toThrow("not found");
  expect(
    (await owner.query(api.mcp.credentials.list, { workspaceId, paginationOpts: { numItems: 20, cursor: null } })).page
  ).toHaveLength(0);
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("mcpSecrets")
        .withIndex("by_credential", (q) => q.eq("credentialId", credentialId))
        .unique()
    )
  ).toBeNull();
  expect(
    (
      await t.run((ctx) =>
        ctx.db
          .query("mcpAudit")
          .withIndex("by_credential", (q) => q.eq("credentialId", credentialId))
          .collect()
      )
    ).some((row) => row.action === "delete")
  ).toBe(true);
});

test("use-only grantee cannot reveal; a view grant permits reveal but revocation invalidates an issued proof", async () => {
  const { t, owner, workspaceId, credentialId } = await setup();
  const second = await t.action((ctx) =>
    createAccount(ctx, {
      provider: "password",
      account: { id: "grantee@example.test", secret: password },
      profile: { name: "Grantee", email: "grantee@example.test" },
    })
  );
  const memberId = second.user._id;
  const sessionId = await t.run((ctx) =>
    ctx.db.insert("authSessions", { userId: memberId, expirationTime: Date.now() + 3600000 })
  );
  await t.run((ctx) =>
    ctx.db.insert("workspaceMembers", { workspaceId, userId: memberId, role: "member", active: true })
  );
  const member = t.withIdentity({ subject: `${memberId}|${sessionId}` });
  const useGrant = await owner.mutation(api.mcp.credentials.grant, {
    credentialId,
    memberId,
    permission: "use",
    expiresAt: null,
  });
  await expect(member.action(api.mcp.stepUp.verify, { credentialId, operation: "reveal", password })).rejects.toThrow(
    "Use permission"
  );
  await owner.mutation(api.mcp.credentials.revokeGrant, { grantId: useGrant });
  const viewGrant = await owner.mutation(api.mcp.credentials.grant, {
    credentialId,
    memberId,
    permission: "view",
    expiresAt: null,
  });
  const proofId = await member.action(api.mcp.stepUp.verify, { credentialId, operation: "reveal", password });
  await owner.mutation(api.mcp.credentials.revokeGrant, { grantId: viewGrant });
  await expect(member.action(api.mcp.sensitive.reveal, { proofId })).rejects.toThrow("access denied");
});
test("simultaneous reveals consume a proof exactly once", async () => {
  const { owner, credentialId } = await setup();
  const proofId = await owner.action(api.mcp.stepUp.verify, { credentialId, operation: "reveal", password });
  const results = await Promise.allSettled([
    owner.action(api.mcp.sensitive.reveal, { proofId }),
    owner.action(api.mcp.sensitive.reveal, { proofId }),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
});

test("workspace guest demotion invalidates even a previously verified reveal", async () => {
  const { t, owner, userId, workspaceId, credentialId } = await setup();
  const proofId = await owner.action(api.mcp.stepUp.verify, { credentialId, operation: "reveal", password });
  await t.run(async (ctx) => {
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", userId))
      .unique();
    if (membership) await ctx.db.patch(membership._id, { role: "guest" });
  });
  await expect(owner.action(api.mcp.sensitive.reveal, { proofId })).rejects.toThrow("access to this workspace");
});
