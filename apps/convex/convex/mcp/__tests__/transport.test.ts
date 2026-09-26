import { afterEach, expect, test, vi } from "vitest";
import { api } from "../../_generated/api";
import { workspaceJourney } from "../../../test-support/fixtures";
const key = btoa("01234567890123456789012345678901");
const secret = "test-only-mcp-token";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
async function setup() {
  vi.stubEnv("SUMMON_CREDENTIAL_KEY", key);
  vi.stubEnv("SUMMON_MCP_URL", "https://mcp.example/mcp");
  const base = await workspaceJourney();
  const credentialId = await base.owner.action(api.mcp.vault.create, {
    workspaceId: base.workspaceId,
    projectId: null,
    remoteProjectId: null,
    name: "Remote MCP",
    accountIdentifier: "service",
    remoteWorkspaceSlug: "remote",
    secret,
  });
  const invocationId = await base.owner.mutation(api.mcp.invocations.propose, {
    credentialId,
    requestId: "request-0001",
    tool: "project",
    argumentsJson: '{"action":"create","name":"External"}',
  });
  return { ...base, credentialId, invocationId };
}
function response(value: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(value), { headers: { "content-type": "application/json", ...headers } });
}
test("explicit confirmation performs MCP handshake then one call; result and audit never expose credentials", async () => {
  const { owner, invocationId, credentialId } = await setup();
  const network = vi
    .fn()
    .mockResolvedValueOnce(
      response(
        { jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-03-26" } },
        { "Mcp-Session-Id": "test-session" }
      )
    )
    .mockResolvedValueOnce(new Response(null, { status: 202 }))
    .mockResolvedValueOnce(
      response({
        jsonrpc: "2.0",
        id: 2,
        result: { content: [{ type: "text", text: `Created with ${secret}` }], token: secret },
      })
    );
  vi.stubGlobal("fetch", network);
  await owner.action(api.mcp.client.confirm, { invocationId });
  expect(network).toHaveBeenCalledTimes(3);
  const invocation = await owner.query(api.mcp.invocations.get, { invocationId });
  expect(invocation.status).toBe("completed");
  expect(invocation.resultJson).not.toContain(secret);
  expect(invocation.resultJson).toContain("[redacted]");
  const request = network.mock.calls[2]?.[1];
  expect(JSON.parse(request.body)).toMatchObject({
    method: "tools/call",
    params: { name: "project", arguments: { action: "create", workspace_slug: "remote" } },
  });
  expect(request.redirect).toBe("error");
  expect(request.headers["Mcp-Session-Id"]).toBe("test-session");
  expect(request.headers["MCP-Protocol-Version"]).toBe("2025-03-26");
  await expect(owner.action(api.mcp.client.confirm, { invocationId })).rejects.toThrow("already been confirmed");
  expect(network).toHaveBeenCalledTimes(3);
  expect(
    JSON.stringify(
      await owner.query(api.mcp.credentials.logs, { credentialId, paginationOpts: { numItems: 20, cursor: null } })
    )
  ).not.toContain(secret);
});
test("a failed external write is marked unknown and never retried automatically", async () => {
  const { owner, invocationId } = await setup();
  const network = vi
    .fn()
    .mockResolvedValueOnce(response({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-11-25" } }))
    .mockResolvedValueOnce(new Response(null, { status: 202 }))
    .mockRejectedValueOnce(new Error("network disconnected"));
  vi.stubGlobal("fetch", network);
  await owner.action(api.mcp.client.confirm, { invocationId });
  expect((await owner.query(api.mcp.invocations.get, { invocationId })).status).toBe("unknown");
  expect(network).toHaveBeenCalledTimes(3);
});
test("membership revoked during handshake prevents the tools/call request", async () => {
  const { t, owner, invocationId, workspaceId, userId } = await setup();
  const network = vi
    .fn()
    .mockResolvedValueOnce(response({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-11-25" } }))
    .mockImplementationOnce(async () => {
      await t.run(async (ctx) => {
        const member = await ctx.db
          .query("workspaceMembers")
          .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", userId))
          .unique();
        if (member) await ctx.db.patch(member._id, { active: false });
      });
      return new Response(null, { status: 202 });
    });
  vi.stubGlobal("fetch", network);
  await owner.action(api.mcp.client.confirm, { invocationId });
  expect(network).toHaveBeenCalledTimes(2);
  expect(await t.run((ctx) => ctx.db.get(invocationId))).toMatchObject({ status: "failed", resultJson: null });
});
test("post-call membership revocation withholds external result and records uncertain write outcome", async () => {
  const { t, owner, invocationId, workspaceId, userId } = await setup();
  const network = vi
    .fn()
    .mockResolvedValueOnce(response({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-11-25" } }))
    .mockResolvedValueOnce(new Response(null, { status: 202 }))
    .mockImplementationOnce(async () => {
      await t.run(async (ctx) => {
        const member = await ctx.db
          .query("workspaceMembers")
          .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", userId))
          .unique();
        if (member) await ctx.db.patch(member._id, { active: false });
      });
      return response({ jsonrpc: "2.0", id: 2, result: { secret_result: "withheld" } });
    });
  vi.stubGlobal("fetch", network);
  await owner.action(api.mcp.client.confirm, { invocationId });
  expect(await t.run((ctx) => ctx.db.get(invocationId))).toMatchObject({ status: "unknown", resultJson: null });
});
test("missing endpoint fails before claim or any network activity", async () => {
  const { owner, invocationId } = await setup();
  vi.stubEnv("SUMMON_MCP_URL", "");
  const network = vi.fn();
  vi.stubGlobal("fetch", network);
  await expect(owner.action(api.mcp.client.confirm, { invocationId })).rejects.toThrow("not configured");
  expect(network).not.toHaveBeenCalled();
  expect((await owner.query(api.mcp.invocations.get, { invocationId })).status).toBe("pending");
});

test("unsupported negotiated protocol stops before notification or tool dispatch", async () => {
  const { owner, invocationId } = await setup();
  const network = vi
    .fn()
    .mockResolvedValueOnce(response({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2026-12-31" } }));
  vi.stubGlobal("fetch", network);
  await owner.action(api.mcp.client.confirm, { invocationId });
  expect(network).toHaveBeenCalledTimes(1);
  expect((await owner.query(api.mcp.invocations.get, { invocationId })).status).toBe("failed");
});
test("SSE handles split multiline events, notifications and matching IDs without waiting for an open stream to close", async () => {
  const { owner, invocationId } = await setup();
  const encoder = new TextEncoder();
  let cancelled = false;
  const events =
    ': comment\r\nevent: message\r\ndata: {"jsonrpc":"2.0","method":"notifications/progress","params":{}}\r\n\r\ndata: {"jsonrpc":"2.0","id":99,"result":{}}\n\ndata: {"jsonrpc":"2.0",\r\ndata: "id":2,"result":{"content":[{"type":"text","text":"Completed"}]}}\r\n\r\ndata: {"jsonrpc":"2.0","method":"notifications/progress"}\n\n';
  const openStream = new ReadableStream({
    start(controller) {
      for (let i = 0; i < events.length; i += 3) controller.enqueue(encoder.encode(events.slice(i, i + 3)));
    },
    cancel() {
      cancelled = true;
    },
  });
  const network = vi
    .fn()
    .mockResolvedValueOnce(response({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-06-18" } }))
    .mockResolvedValueOnce(new Response(null, { status: 202 }))
    .mockResolvedValueOnce(new Response(openStream, { headers: { "content-type": "text/event-stream" } }));
  vi.stubGlobal("fetch", network);
  await owner.action(api.mcp.client.confirm, { invocationId });
  expect(cancelled).toBe(true);
  expect((await owner.query(api.mcp.invocations.get, { invocationId })).resultJson).toContain("Completed");
  expect(network.mock.calls[1]?.[1].headers["MCP-Protocol-Version"]).toBe("2025-06-18");
});
