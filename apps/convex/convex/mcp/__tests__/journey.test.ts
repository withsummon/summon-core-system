import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
import { encrypt, decrypt } from "../crypto";
const dummySecret = "test-only-plane-pat";
const dummyKey = btoa("01234567890123456789012345678901");
const page = { numItems: 20, cursor: null };
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
async function setup() {
  vi.stubEnv("SUMMON_CREDENTIAL_KEY", dummyKey);
  const base = await workspaceJourney();
  const credentialId = await base.owner.action(api.mcp.vault.create, {
    workspaceId: base.workspaceId,
    projectId: null,
    remoteProjectId: null,
    remoteWorkspaceSlug: "remote-workspace",
    name: "Plane integration",
    accountIdentifier: "service-user",
    secret: dummySecret,
  });
  const userId = await base.t.run((ctx) => ctx.db.insert("users", { name: "Member" }));
  await base.t.run((ctx) =>
    ctx.db.insert("workspaceMembers", { workspaceId: base.workspaceId, userId, role: "member", active: true })
  );
  return { ...base, credentialId, memberId: userId, member: base.t.withIdentity({ subject: userId }) };
}
test("vault encrypts secrets at rest and public reads never expose ciphertext or cleartext", async () => {
  const { t, owner, workspaceId, credentialId } = await setup();
  const visible = JSON.stringify(await owner.query(api.mcp.credentials.get, { credentialId }));
  const list = JSON.stringify(await owner.query(api.mcp.credentials.list, { workspaceId, paginationOpts: page }));
  for (const value of [visible, list]) {
    expect(value).not.toContain(dummySecret);
    expect(value).not.toContain("ciphertext");
  }
  const stored = await t.run((ctx) =>
    ctx.db
      .query("mcpSecrets")
      .withIndex("by_credential", (q) => q.eq("credentialId", credentialId))
      .unique()
  );
  expect(stored).not.toBeNull();
  if (!stored) throw new Error("Fixture secret missing");
  expect(stored.ciphertext).not.toContain(dummySecret);
  expect(await decrypt(stored)).toBe(dummySecret);
  expect(
    (await owner.query(api.mcp.credentials.logs, { credentialId, paginationOpts: page })).page.map((row) => row.action)
  ).toEqual(["create"]);
});
test("encryption is randomized, authenticates content and fails closed without a key", async () => {
  vi.stubEnv("SUMMON_CREDENTIAL_KEY", dummyKey);
  const first = await encrypt(dummySecret),
    second = await encrypt(dummySecret);
  expect(first.nonce).not.toBe(second.nonce);
  await expect(decrypt({ ...first, ciphertext: second.ciphertext })).rejects.toThrow();
  vi.stubEnv("SUMMON_CREDENTIAL_KEY", "");
  await expect(encrypt(dummySecret)).rejects.toThrow("not configured");
});
test("view grants do not authorize use; expired or revoked grants deny access", async () => {
  const { t, owner, member, memberId, credentialId } = await setup();
  await expect(member.query(api.mcp.credentials.get, { credentialId })).rejects.toThrow("access denied");
  const grantId = await owner.mutation(api.mcp.credentials.grant, {
    credentialId,
    memberId,
    permission: "view",
    expiresAt: null,
  });
  expect((await member.query(api.mcp.credentials.get, { credentialId })).permission).toBe("view");
  await expect(
    member.mutation(api.mcp.invocations.propose, {
      credentialId,
      requestId: "request-0001",
      tool: "project",
      argumentsJson: '{"action":"list"}',
    })
  ).rejects.toThrow("access denied");
  await t.run((ctx) => ctx.db.patch(grantId, { expiresAt: Date.now() - 1 }));
  await expect(member.query(api.mcp.credentials.get, { credentialId })).rejects.toThrow("access denied");
  await owner.mutation(api.mcp.credentials.revokeGrant, { grantId });
  await expect(member.query(api.mcp.credentials.get, { credentialId })).rejects.toThrow("access denied");
});
test("preview is idempotent, credential-scoped, secret-free and performs no network request", async () => {
  const { owner, credentialId } = await setup();
  const network = vi.fn();
  vi.stubGlobal("fetch", network);
  const args = {
    credentialId,
    requestId: "request-0001",
    tool: "workitem",
    argumentsJson: '{"action":"update","project_id":"remote-project","work_item_id":"remote-task","name":"Updated"}',
  };
  const invocationId = await owner.mutation(api.mcp.invocations.propose, args);
  expect(await owner.mutation(api.mcp.invocations.propose, args)).toBe(invocationId);
  expect((await owner.query(api.mcp.invocations.get, { invocationId })).status).toBe("pending");
  expect(network).not.toHaveBeenCalled();
  await expect(
    owner.mutation(api.mcp.invocations.propose, { ...args, argumentsJson: '{"action":"update","token":"secret"}' })
  ).rejects.toThrow("Credentials must not");
  await expect(
    owner.mutation(api.mcp.invocations.propose, {
      ...args,
      argumentsJson: '{"action":"update","workspace_slug":"other"}',
    })
  ).rejects.toThrow("workspace does not match");
  await expect(owner.mutation(api.mcp.invocations.propose, { ...args, tool: "shell" })).rejects.toThrow(
    "not allowlisted"
  );
});
test("credential grant revocation between preview and confirmation prevents dispatch", async () => {
  const { owner, member, memberId, credentialId } = await setup();
  const grantId = await owner.mutation(api.mcp.credentials.grant, {
    credentialId,
    memberId,
    permission: "use",
    expiresAt: null,
  });
  const invocationId = await member.mutation(api.mcp.invocations.propose, {
    credentialId,
    requestId: "request-0001",
    tool: "project",
    argumentsJson: '{"action":"list"}',
  });
  await owner.mutation(api.mcp.credentials.revokeGrant, { grantId });
  await expect(member.mutation(internal.mcp.invocations.claim, { invocationId })).rejects.toThrow("access denied");
});
test("confirmed external writes cannot be dispatched twice and ambiguous failure never automatically retries", async () => {
  const { owner, credentialId } = await setup();
  const invocationId = await owner.mutation(api.mcp.invocations.propose, {
    credentialId,
    requestId: "request-0001",
    tool: "project",
    argumentsJson: '{"action":"create","name":"Remote project"}',
  });
  await owner.mutation(internal.mcp.invocations.claim, { invocationId });
  await expect(owner.mutation(internal.mcp.invocations.claim, { invocationId })).rejects.toThrow(
    "already been confirmed"
  );
  await owner.mutation(internal.mcp.invocations.fail, { invocationId, ambiguous: true });
  expect((await owner.query(api.mcp.invocations.get, { invocationId })).status).toBe("unknown");
  await expect(owner.mutation(internal.mcp.invocations.claim, { invocationId })).rejects.toThrow("Do not retry");
});

test("metadata compare-and-set invalidates old approval previews and rejects stale form saves", async () => {
  const { owner, credentialId } = await setup();
  const invocationId = await owner.mutation(api.mcp.invocations.propose, {
    credentialId,
    requestId: "request-0001",
    tool: "project",
    argumentsJson: '{"action":"list"}',
  });
  const settings = {
    credentialId,
    expectedRevision: 0,
    name: "Updated integration",
    accountIdentifier: "service-user",
    projectId: null,
    remoteProjectId: null,
    remoteWorkspaceSlug: "remote-workspace",
  };
  await owner.mutation(api.mcp.credentials.update, settings);
  await expect(owner.mutation(api.mcp.credentials.update, settings)).rejects.toThrow("Credential changed");
  await expect(owner.mutation(internal.mcp.invocations.claim, { invocationId })).rejects.toThrow(
    "Request a new preview"
  );
});
test("native project scope binds the remote project and excludes workspace-wide member calls", async () => {
  const { owner, workspaceId, projectId } = await setup();
  const credentialId = await owner.action(api.mcp.vault.create, {
    workspaceId,
    projectId,
    remoteProjectId: "remote-project",
    remoteWorkspaceSlug: "remote",
    name: "Project MCP",
    accountIdentifier: "service",
    secret: dummySecret,
  });
  await expect(
    owner.mutation(api.mcp.invocations.propose, {
      credentialId,
      requestId: "request-0001",
      tool: "workitem",
      argumentsJson: '{"action":"list","project_id":"other-project"}',
    })
  ).rejects.toThrow("project does not match");
  await expect(
    owner.mutation(api.mcp.invocations.propose, {
      credentialId,
      requestId: "request-0002",
      tool: "member",
      argumentsJson: '{"action":"list_workspace","project_id":"remote-project"}',
    })
  ).rejects.toThrow("outside the credential project scope");
  const invocationId = await owner.mutation(api.mcp.invocations.propose, {
    credentialId,
    requestId: "request-0003",
    tool: "workitem",
    argumentsJson: '{"action":"list","project_id":"remote-project"}',
  });
  expect((await owner.query(api.mcp.invocations.get, { invocationId })).write).toBe(false);
});
