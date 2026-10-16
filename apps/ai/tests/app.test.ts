import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { operations } from "@plane/summon-contract";
import { chatPath } from "@plane/summon-contract/chat-route";
import { INSTRUCTIONS } from "../src/chat";
import { parseRpcBody } from "../src/plane-mcp";
import {
  AI_TOKEN,
  ASSISTANT_MESSAGE_ID,
  CONVERSATION_ID,
  defaultDjango,
  makeApp,
  textModel,
  readUIStream,
  SLUG,
  type TestApp,
  USER_MESSAGE_ID,
  WEB_ORIGIN,
} from "./harness";

const CHAT_PATH = chatPath(SLUG, CONVERSATION_ID);

let app: TestApp | undefined;
afterEach(async () => {
  await app?.dispose();
  app = undefined;
});

const chat = (
  current: TestApp,
  headers: Record<string, string> = {},
  body: unknown = { content: "What is at risk?" }
) =>
  current.fetch(CHAT_PATH, {
    method: "POST",
    headers: { "content-type": "application/json", origin: WEB_ORIGIN, cookie: "sessionid=valid", ...headers },
    body: JSON.stringify(body),
  });

/** The `complete/` call, which the route makes before it closes the stream. */
const completeCall = (current: TestApp) => current.seen.find((request) => request.path.endsWith("/complete/"));

/** The JSON-RPC result of an MCP response, past any notifications the stream sends first. */
const rpcResult = async (response: Response) =>
  (parseRpcBody(await response.text()) as { result: Record<string, unknown> }).result;

describe("health", () => {
  it("reports the build", async () => {
    app = makeApp();
    const response = await app.fetch("/ai/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", version: "test" });
  });
});

describe("chat", () => {
  it("lets only the web app's origin call it with credentials", async () => {
    app = makeApp();
    const preflight = (origin: string) =>
      app!.fetch(CHAT_PATH, {
        method: "OPTIONS",
        headers: { origin, "access-control-request-method": "POST", "access-control-request-headers": "content-type" },
      });
    const allowed = await preflight(WEB_ORIGIN);
    expect(allowed.headers.get("access-control-allow-origin")).toBe(WEB_ORIGIN);
    expect(allowed.headers.get("access-control-allow-credentials")).toBe("true");
    // Only the web origin is ever allowed; a browser rejects any other caller's response.
    expect((await preflight("https://evil.test")).headers.get("access-control-allow-origin")).toBe(WEB_ORIGIN);
  });

  it("settles a provider failure as a failed reply with its code", async () => {
    const model = new MockLanguageModelV4({
      doStream: async () => {
        throw new APICallError({
          message: "rate limited",
          url: "https://openrouter.ai",
          requestBodyValues: {},
          statusCode: 429,
          isRetryable: false,
        });
      },
    });
    app = makeApp({ model });
    const chunks = await readUIStream(await chat(app));

    expect(chunks.find((chunk) => chunk.type === "error")).toEqual({ type: "error", errorText: "llm_rate_limited" });
    const complete = completeCall(app);
    expect(complete?.body).toMatchObject({
      status: "failed",
      content: "llm_rate_limited",
      error_code: "llm_rate_limited",
    });
  });

  it("refuses requests without a session", async () => {
    app = makeApp();
    const response = await chat(app, { cookie: "" });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error_code: "unauthenticated" });
  });

  it("refuses a session Django rejects", async () => {
    app = makeApp();
    expect((await chat(app, { cookie: "sessionid=expired" })).status).toBe(401);
  });

  it("refuses cookie requests from another origin before asking Django", async () => {
    app = makeApp();
    const response = await chat(app, { origin: "https://evil.test" });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error_code: "forbidden_origin" });
    expect(app.seen).toEqual([]);
  });

  it("rejects an invalid body", async () => {
    app = makeApp();
    expect((await chat(app, {}, { content: "" })).status).toBe(400);
  });

  it("passes Django's refusal of the turn through", async () => {
    app = makeApp({
      django: (request) =>
        request.path.endsWith("/turns/") ? { status: 404, body: { detail: "Not found." } } : defaultDjango(request),
    });
    const response = await chat(app);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error_code: "not_found" });
  });

  it("answers 502 when Django is unreachable", async () => {
    app = makeApp({ django: (request) => (request.path.endsWith("/turns/") ? "down" : defaultDjango(request)) });
    expect((await chat(app)).status).toBe(502);
  });

  it("answers 502 when Django's reply is off-contract", async () => {
    app = makeApp({
      django: (request) =>
        request.path.endsWith("/turns/") ? { status: 201, body: { unexpected: true } } : defaultDjango(request),
    });
    const response = await chat(app);
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error_code: "summon_unavailable" });
  });

  it("streams the reply under Django's message id and persists it", async () => {
    app = makeApp();
    const response = await chat(app);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const chunks = await readUIStream(response);
    expect(chunks[0]).toEqual({
      type: "start",
      messageId: ASSISTANT_MESSAGE_ID,
      messageMetadata: { userMessageId: USER_MESSAGE_ID, model: "openai/gpt-5-mini" },
    });
    expect(chunks[1]).toEqual({ type: "data-citations", data: { citations: [], truncated: false } });
    const text = chunks
      .filter((chunk) => chunk.type === "text-delta")
      .map((chunk) => chunk.delta)
      .join("");
    expect(text).toBe("Two items are overdue.");
    expect(chunks.at(-1)).toMatchObject({ type: "finish", messageMetadata: { inputTokens: 120, outputTokens: 9 } });

    const start = app.seen.find((request) => request.path.endsWith("/turns/"));
    expect(start?.headers["x-summon-ai-token"]).toBe(AI_TOKEN);
    expect(start?.headers.cookie).toBe("sessionid=valid");
    expect(start?.body).toEqual({ content: "What is at risk?" });

    const complete = completeCall(app);
    expect(complete?.headers["x-summon-ai-token"]).toBe(AI_TOKEN);
    expect(complete?.body).toMatchObject({
      status: "completed",
      content: "Two items are overdue.",
      provider: "openrouter",
      model: "openai/gpt-5-mini",
      input_tokens: 120,
      output_tokens: 9,
      usage: { cached_input_tokens: 100, steps: 1 },
    });
  });

  it("retries complete/ only while Django's failure is transient", async () => {
    const completeCalls = async (failure: number) => {
      let failed = false;
      app = makeApp({
        django: (request) => {
          if (request.path.endsWith("/complete/") && !failed) {
            failed = true;
            return { status: failure, body: { detail: "failed" } };
          }
          return defaultDjango(request);
        },
      });
      await readUIStream(await chat(app));
      const count = app.seen.filter((request) => request.path.endsWith("/complete/")).length;
      await app.dispose();
      app = undefined;
      return count;
    };
    expect(await completeCalls(503)).toBe(2);
    expect(await completeCalls(400)).toBe(1);
  });

  it("puts the per-turn context in the last user message, after a stable system prompt", async () => {
    const model = textModel("Two items are overdue.");
    app = makeApp({ model });
    await readUIStream(await chat(app));

    const [call] = model.doStreamCalls;
    expect(call?.prompt[0]).toEqual({ role: "system", content: INSTRUCTIONS });
    expect(call?.prompt.at(-1)).toMatchObject({
      role: "user",
      content: [
        { type: "text", text: "<context>\nProject Website: 2 overdue work items.\n</context>\n\nWhat is at risk?" },
      ],
    });
    expect(call?.tools?.map((tool) => tool.name)).toContain("plane");
  });
});

describe("MCP", () => {
  const rpc = (current: TestApp, body: unknown, headers: Record<string, string> = {}) =>
    current.fetch("/ai/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "x-api-key": "plane_api_good",
        "x-workspace-slug": SLUG,
        ...headers,
      },
      body: JSON.stringify(body),
    });

  const initialize = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } },
  };

  it("requires an API key and workspace", async () => {
    app = makeApp();
    const response = await rpc(app, initialize, { "x-api-key": "", "x-workspace-slug": "" });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error_code: "api_key_required" });
  });

  it("refuses a key Django doesn't accept for the workspace", async () => {
    app = makeApp();
    const response = await rpc(app, initialize, { "x-api-key": "plane_api_other" });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error_code: "api_key_rejected" });
  });

  it("points clients without credentials at the OAuth metadata", async () => {
    app = makeApp();
    const response = await rpc(app, initialize, { "x-api-key": "", "x-workspace-slug": "" });
    expect(response.headers.get("www-authenticate")).toBe(
      `Bearer resource_metadata="${WEB_ORIGIN}/.well-known/oauth-protected-resource/ai/mcp"`
    );
    const metadata = await app.fetch("/.well-known/oauth-protected-resource/ai/mcp");
    expect(await metadata.json()).toMatchObject({
      resource: `${WEB_ORIGIN}/ai/mcp`,
      authorization_servers: [WEB_ORIGIN],
    });
  });

  it("names the toolset endpoint in its challenge, and marks a refused token invalid", async () => {
    app = makeApp();
    const response = await app.fetch("/ai/mcp/x/plane/readonly", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer plane_api_expired" },
      body: JSON.stringify(initialize),
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      `Bearer resource_metadata="${WEB_ORIGIN}/.well-known/oauth-protected-resource/ai/mcp/x/plane/readonly", error="invalid_token"`
    );
    const metadata = await app.fetch("/.well-known/oauth-protected-resource/ai/mcp/x/plane/readonly");
    expect(await metadata.json()).toMatchObject({ resource: `${WEB_ORIGIN}/ai/mcp/x/plane/readonly` });
  });

  it("takes an OAuth access token alone and works in the token's workspace", async () => {
    app = makeApp();
    const response = await rpc(app, initialize, {
      "x-api-key": "",
      "x-workspace-slug": "",
      authorization: "Bearer plane_api_good",
    });
    expect(response.status).toBe(200);
    expect(app.seen.map((request) => request.path)).toEqual([
      "/api/summon/api-key/workspace/",
      `/api/summon/workspaces/${SLUG}/access/me/`,
    ]);
  });

  it("passes Django's rate limit through instead of reporting Summon down", async () => {
    app = makeApp({
      django: (request) =>
        request.path.endsWith("/access/me/") ? { status: 429, body: { detail: "Request was throttled." } } : undefined,
    });
    const response = await rpc(app, initialize);
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ error_code: "rate_limited" });
  });

  /** Initializes a session and returns the headers later requests need. */
  const session = async (current: TestApp) => {
    const response = await rpc(current, initialize);
    expect(response.status).toBe(200);
    const id = response.headers.get("mcp-session-id");
    await rpc(current, { jsonrpc: "2.0", method: "notifications/initialized" }, id ? { "mcp-session-id": id } : {});
    return id ? { "mcp-session-id": id } : {};
  };

  it("lists every Summon tool operation and no credential or internal ones", async () => {
    app = makeApp();
    const headers = await session(app);
    const listed = await rpcResult(await rpc(app, { jsonrpc: "2.0", id: 2, method: "tools/list" }, headers));
    const tools = listed.tools as Array<{ name: string; annotations?: { readOnlyHint?: boolean } }>;
    const names = tools.map((tool) => tool.name);

    expect(names).toEqual(expect.arrayContaining(Object.keys(operations)));
    expect(names.filter((name) => /credential|internal|turn|plane_tool_call/.test(name))).toEqual([]);
    expect(tools.find((tool) => tool.name === "client_list")?.annotations?.readOnlyHint).toBe(true);
    expect(tools.find((tool) => tool.name === "client_create")?.annotations?.readOnlyHint).toBe(false);
  });

  it("calls Django as the key's user in the key's workspace", async () => {
    app = makeApp({
      django: (request) =>
        request.path === `/api/summon/workspaces/${SLUG}/clients/`
          ? { status: 200, body: ["Acme", "Globex", "Initech"].map((name, index) => ({ id: `c${index}`, name })) }
          : defaultDjango(request),
    });
    const headers = await session(app);
    const called = await rpcResult(
      await rpc(
        app,
        { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "client_list", arguments: { limit: 2 } } },
        headers
      )
    );

    // A list answers one page.
    expect(called.isError).toBe(false);
    expect(called.content).toEqual([
      {
        type: "text",
        text: JSON.stringify({
          results: [
            { id: "c0", name: "Acme" },
            { id: "c1", name: "Globex" },
          ],
          total: 3,
          next_offset: 2,
        }),
      },
    ]);
    const call = app.seen.find((request) => request.path === `/api/summon/workspaces/${SLUG}/clients/`);
    expect(call?.headers["x-api-key"]).toBe("plane_api_good");
    expect(call?.headers["x-summon-ai-token"]).toBeUndefined();
    expect(call?.headers.cookie).toBeUndefined();
  });

  it("reports a delete's empty 204 as ok", async () => {
    app = makeApp({
      django: (request) =>
        request.method === "DELETE" && request.path === `/api/summon/workspaces/${SLUG}/clients/c1/`
          ? { status: 204 }
          : defaultDjango(request),
    });
    const headers = await session(app);
    const called = await rpcResult(
      await rpc(
        app,
        { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "client_delete", arguments: { pk: "c1" } } },
        headers
      )
    );

    expect(called).toMatchObject({ isError: false, content: [{ type: "text", text: '{"ok":true}' }] });
  });

  it("refuses a call missing a path id instead of asking Django for a broken URL", async () => {
    app = makeApp();
    const headers = await session(app);
    const called = await rpcResult(
      await rpc(
        app,
        { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "client_get", arguments: {} } },
        headers
      )
    );

    expect(called.isError).toBe(true);
    expect(JSON.parse((called.content as Array<{ text: string }>)[0]!.text)).toMatchObject({
      status: 400,
      error: { pk: ["This field is required."] },
    });
    expect(app.seen.filter((request) => request.path.includes("/clients/"))).toEqual([]);
  });

  it("proxies Plane MCP tools with the caller's key", async () => {
    const planeResult = { content: [{ type: "text", text: "[]" }], isError: false };
    app = makeApp({
      django: (request) => {
        if (request.path !== "/mcp") return defaultDjango(request);
        const method = (request.body as { method?: string } | undefined)?.method;
        if (method === "tools/call") return { status: 200, body: { jsonrpc: "2.0", id: 1, result: planeResult } };
        return { status: 400, body: { jsonrpc: "2.0", id: 1, error: { code: -32600, message: "unexpected" } } };
      },
    });
    const headers = await session(app);
    const listed = await rpcResult(await rpc(app, { jsonrpc: "2.0", id: 2, method: "tools/list" }, headers));
    expect((listed.tools as Array<{ name: string }>).map((tool) => tool.name)).toContain("plane_workitem");

    const called = await rpcResult(
      await rpc(
        app,
        {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "plane_project", arguments: { action: "list" } },
        },
        headers
      )
    );

    expect(called).toEqual(planeResult);
    // One stateless POST per call: no initialize handshake.
    const forwarded = app.seen.filter((request) => request.path === "/mcp");
    expect(forwarded).toHaveLength(1);
    expect(forwarded[0]?.headers.authorization).toBe("Bearer plane_api_good");
    expect(forwarded[0]?.headers["x-workspace-slug"]).toBe(SLUG);
    expect(forwarded[0]?.body).toMatchObject({
      method: "tools/call",
      params: { name: "project", arguments: { action: "list" } },
    });
  });

  it("accepts a Bearer key, as MCP clients send it", async () => {
    app = makeApp();
    const response = await rpc(app, initialize, { "x-api-key": "", authorization: "Bearer plane_api_good" });
    expect(response.status).toBe(200);
  });

  /** A 2026-07-28 request: no handshake, version and capabilities travel with each request. */
  const stateless = (current: TestApp, method: string, params: Record<string, unknown>, path = "/ai/mcp") =>
    current
      .fetch(path, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "x-api-key": "plane_api_good",
          "x-workspace-slug": SLUG,
          "mcp-protocol-version": "2026-07-28",
          "mcp-method": method,
          ...(typeof params.name === "string" ? { "mcp-name": params.name } : {}),
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method,
          params: {
            ...params,
            _meta: {
              "io.modelcontextprotocol/protocolVersion": "2026-07-28",
              "io.modelcontextprotocol/clientCapabilities": {},
              "io.modelcontextprotocol/clientInfo": { name: "test", version: "1" },
            },
          },
        }),
      })
      .then(rpcResult);

  it("serves the 2026-07-28 protocol without a handshake", async () => {
    app = makeApp();
    const discovered = await stateless(app, "server/discover", {});
    expect(discovered.supportedVersions).toContain("2026-07-28");
    const result = await stateless(app, "tools/call", { name: "ai_status", arguments: {} });
    expect(result.content).toBeDefined();
  });

  type ListedTool = {
    name: string;
    title?: string;
    annotations?: { readOnlyHint?: boolean };
    inputSchema: { properties?: { action?: { enum?: Array<string> } } };
  };

  it("serves one toolset, or only reads, on their own endpoints", async () => {
    const plane = vi.fn(() => ({ status: 500 }));
    app = makeApp({ django: (request) => (request.path === "/mcp" ? plane() : defaultDjango(request)) });
    const list = async (path: string) =>
      ((await stateless(app!, "tools/list", {}, path)).tools as Array<ListedTool>).map((tool) => tool);

    const readOnly = await list("/ai/mcp/readonly");
    expect(readOnly.every((tool) => tool.annotations?.readOnlyHint)).toBe(true);
    expect(readOnly.map((tool) => tool.name)).toContain("client_list");
    expect(readOnly.map((tool) => tool.name)).not.toContain("client_create");
    expect(readOnly.find((tool) => tool.name === "plane_label")?.inputSchema.properties?.action?.enum).toEqual([
      "list",
      "retrieve",
    ]);
    // A write action is refused here even if a client sends it anyway.
    const refused = await stateless(
      app,
      "tools/call",
      { name: "plane_label", arguments: { action: "delete", project_id: "p", label_id: "l" } },
      "/ai/mcp/readonly"
    );
    expect(refused.isError).toBe(true);
    expect(plane).not.toHaveBeenCalled();

    const commercial = (await list("/ai/mcp/x/commercial")).map((tool) => tool.name);
    expect(commercial).toContain("client_create");
    expect(commercial.some((name) => name.startsWith("meeting_") || name.startsWith("plane_"))).toBe(false);
    expect((await list("/ai/mcp/x/plane/readonly")).every((tool) => tool.name.startsWith("plane_"))).toBe(true);
    expect((await list("/ai/mcp")).find((tool) => tool.name === "client_list")?.title).toBe("List clients");
  });

  it("reports a Plane failure by its status, without Plane's text", async () => {
    app = makeApp({
      django: (request) =>
        request.path === "/mcp"
          ? {
              status: 200,
              body: {
                jsonrpc: "2.0",
                id: 1,
                // Plane MCP reports some failures as plain text without `isError`.
                result: { content: [{ type: "text", text: "Error calling tool 'project': HTTP 404 <raw body>" }] },
              },
            }
          : defaultDjango(request),
    });
    const result = await stateless(app, "tools/call", { name: "plane_project", arguments: { action: "retrieve" } });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      {
        type: "text",
        text: JSON.stringify({ ok: false, status: 404, message: "Not found, or not available on this Plane." }),
      },
    ]);
  });
});
