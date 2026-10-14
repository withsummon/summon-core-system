/**
 * Client for the Plane MCP server (`makeplane/plane-mcp-server`, API-key route). The Summon MCP
 * server re-exposes its tools so one MCP connection covers Plane (projects, work items, cycles, …)
 * and Summon. Calls carry the caller's own API key; Plane enforces its permissions.
 */
import { Context, Effect, Layer, Redacted, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";
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

type ActionProperty = { readonly enum?: ReadonlyArray<string> };

/** The values of a Plane tool's `action` input; each Plane tool bundles several operations. */
export const planeActions = (tool: PlaneTool): ReadonlyArray<string> =>
  (tool.inputSchema.properties as Readonly<Record<string, ActionProperty>> | undefined)?.action?.enum ?? [];

/** Plane actions that only read, by Plane's naming (`list_workitems`, `retrieve_role`, `download_url`, …). */
export const isReadAction = (action: string): boolean =>
  /^(list|retrieve|search|read|me$|download_url$|worklog_summary$)/.test(action);

/** The tool without some of its actions: gone from the `action` enum and from the description's action list. */
export const withoutActions = <T extends PlaneTool>(tool: T, actions: ReadonlyArray<string>): T => {
  if (actions.length === 0) return tool;
  const properties = tool.inputSchema.properties as Readonly<Record<string, ActionProperty>>;
  const description = tool.description
    ?.split("\n")
    .filter((line) => !actions.some((name) => line.startsWith(`  ${name} (`)))
    .join("\n");
  return {
    ...tool,
    ...(description === undefined ? {} : { description }),
    inputSchema: {
      ...tool.inputSchema,
      properties: {
        ...properties,
        action: { ...properties.action, enum: planeActions(tool).filter((name) => !actions.includes(name)) },
      },
    },
  };
};

const JsonRpcResponse = Schema.Struct({
  result: Schema.optionalKey(Schema.Json),
  error: Schema.optionalKey(Schema.Struct({ code: Schema.Number, message: Schema.String })),
});

// Keep in step with the other Plane MCP client, apps/api/plane/summon/services/mcp.py `call_plane_tool`.
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
  /** Calls one Plane MCP tool as the caller; Plane's `CallToolResult` comes back undecoded. */
  readonly callTool: (
    caller: ApiKeyCaller,
    name: string,
    args: Readonly<Record<string, unknown>>
  ) => Effect.Effect<Schema.Json, PlaneMcpUnavailable>;
}

export class PlaneMcp extends Context.Service<PlaneMcp, PlaneMcpShape>()("@plane/ai/PlaneMcp") {
  static readonly layer = Layer.effect(
    PlaneMcp,
    Effect.gen(function* () {
      const config = yield* AppConfig;
      const http = yield* HttpClient.HttpClient;

      // The API-key route is stateless: one POST per call, with no initialize handshake or session.
      const callTool: PlaneMcpShape["callTool"] = (caller, name, args) =>
        HttpClientRequest.post(config.planeMcpUrl).pipe(
          HttpClientRequest.setHeaders({
            authorization: `Bearer ${Redacted.value(caller.apiKey)}`,
            "x-workspace-slug": caller.workspaceSlug,
            accept: "application/json, text/event-stream",
            "mcp-protocol-version": PROTOCOL_VERSION,
          }),
          HttpClientRequest.bodyJsonUnsafe({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name, arguments: args },
          }),
          http.execute,
          Effect.flatMap(HttpClientResponse.filterStatusOk),
          Effect.flatMap((response) => response.text),
          Effect.flatMap((text) => Effect.try(() => parseRpcBody(text))),
          Effect.flatMap(Schema.decodeUnknownEffect(JsonRpcResponse)),
          Effect.flatMap((response) =>
            response.error ? Effect.fail(response.error) : Effect.succeed(response.result ?? null)
          ),
          Effect.mapError((cause) => new PlaneMcpUnavailable({ cause })),
          Effect.withSpan("PlaneMcp.callTool", { attributes: { tool: name } })
        );

      return PlaneMcp.of({ callTool });
    })
  );
}
