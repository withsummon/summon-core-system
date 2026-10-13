/**
 * Client for the Plane MCP server (`makeplane/plane-mcp-server`, API-key route). The Summon MCP
 * server re-exposes its tools so one MCP connection covers Plane (projects, work items, cycles, …)
 * and Summon. Calls carry the caller's own API key; Plane enforces its permissions.
 */
import { Context, Effect, Layer, Redacted, Schema } from "effect";
import { HttpClient, HttpClientRequest, type HttpClientResponse } from "effect/http";
import type { ApiKeyCaller } from "./auth";
import { AppConfig } from "./config";
import snapshot from "./plane-mcp-tools.json" with { type: "json" };

export class PlaneMcpUnavailable extends Schema.TaggedError<PlaneMcpUnavailable>()("PlaneMcpUnavailable", {
  cause: Schema.Defect(),
}) {}

export interface PlaneTool {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema: { readonly type: "object" } & Readonly<Record<string, unknown>>;
}

/** Tools of the pinned Plane MCP server image, listed by `scripts/snapshot-plane-mcp.ts`. */
export const planeTools: ReadonlyArray<PlaneTool> = snapshot.tools as ReadonlyArray<PlaneTool>;
export const PLANE_MCP_IMAGE = snapshot.server;

const JsonRpcResponse = Schema.Struct({
  result: Schema.optionalKey(Schema.Json),
  error: Schema.optionalKey(Schema.Struct({ code: Schema.Number, message: Schema.String })),
});

const PROTOCOL_VERSION = "2025-06-18";

/** Streamable HTTP answers either JSON or one SSE event; both carry a JSON-RPC response. */
export const parseRpcBody = (text: string): unknown => {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const data = trimmed
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .at(-1);
  if (data === undefined) throw new Error("Plane MCP returned no JSON-RPC message");
  return JSON.parse(data);
};

export interface PlaneMcpShape {
  readonly request: (
    caller: ApiKeyCaller,
    method: "tools/call" | "tools/list",
    params: Record<string, unknown>
  ) => Effect.Effect<Schema.Json, PlaneMcpUnavailable>;
}

export class PlaneMcp extends Context.Service<PlaneMcp, PlaneMcpShape>()("@plane/ai/PlaneMcp") {
  static readonly layer = Layer.effect(
    PlaneMcp,
    Effect.gen(function* () {
      const config = yield* AppConfig;
      const http = yield* HttpClient.HttpClient;

      const post = (headers: Record<string, string>, body: unknown) =>
        HttpClientRequest.post(config.planeMcpUrl).pipe(
          HttpClientRequest.setHeaders({
            ...headers,
            accept: "application/json, text/event-stream",
            "mcp-protocol-version": PROTOCOL_VERSION,
          }),
          HttpClientRequest.bodyJsonUnsafe(body),
          http.execute,
          Effect.flatMap((response) => (response.status >= 400 ? Effect.fail(response) : Effect.succeed(response)))
        );

      const decode = (response: HttpClientResponse.HttpClientResponse) =>
        response.text.pipe(
          Effect.flatMap((text) => Effect.try(() => parseRpcBody(text))),
          Effect.flatMap(Schema.decodeUnknownEffect(JsonRpcResponse))
        );

      // One short-lived MCP session per call, like Django's `services/mcp.py`.
      const request: PlaneMcpShape["request"] = (caller, method, params) =>
        Effect.gen(function* () {
          const headers = {
            authorization: `Bearer ${Redacted.value(caller.apiKey)}`,
            "x-workspace-slug": caller.workspaceSlug,
          };
          const initialized = yield* post(headers, {
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: PROTOCOL_VERSION,
              capabilities: {},
              clientInfo: { name: "summon-ai", version: "1" },
            },
          });
          yield* decode(initialized);
          const sessionId = initialized.headers["mcp-session-id"];
          const session = sessionId ? { ...headers, "mcp-session-id": sessionId } : headers;
          yield* post(session, { jsonrpc: "2.0", method: "notifications/initialized" });
          const response = yield* decode(yield* post(session, { jsonrpc: "2.0", id: 2, method, params }));
          if (response.error) return yield* Effect.fail(response.error);
          return response.result ?? null;
        }).pipe(
          Effect.mapError((cause) => new PlaneMcpUnavailable({ cause })),
          Effect.withSpan("PlaneMcp.request", { attributes: { method } })
        );

      return PlaneMcp.of({ request });
    })
  );
}
