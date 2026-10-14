/**
 * The Summon MCP server at `/ai/mcp` (Streamable HTTP), for MCP clients such as Claude or Cursor.
 *
 * Auth: a Plane API key (`X-Api-Key` or `Authorization: Bearer`) plus `X-Workspace-Slug`, the same
 * headers the Plane MCP server takes. Django checks the key belongs to that workspace.
 *
 * Tools:
 * - every Summon operation Django marks `x-summon-tool: read|write`, generated from the schema;
 * - every tool of the pinned Plane MCP server, proxied with the caller's key, prefixed `plane_`.
 * Credentials, access management and the assistant's internal protocol are never tools (`none`).
 */
import { operations, type SummonOperation } from "@plane/summon-contract";
import { Context, Effect, Layer, Option, Schema } from "effect";
import { McpProtocol, McpSchema, McpServer } from "effect/ai";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { Auth, type ApiKeyCaller } from "./auth";
import { AppConfig } from "./config";
import { Django } from "./django";
import { PlaneMcp, planeTools } from "./plane-mcp";
import { toToolOutput } from "./tools";

export const MCP_PATH = "/ai/mcp";
export const PLANE_TOOL_PREFIX = "plane_";

const INSTRUCTIONS =
  "Summon is a project delivery workspace on Plane. Summon tools (clients, opportunities, meetings, " +
  "automation, reports) and Plane tools (prefixed plane_: projects, work items, cycles, …) act as the " +
  "API key's user in the X-Workspace-Slug workspace. Tools marked read-only never change data.";

const jsonResult = (value: unknown, isError: boolean) =>
  new McpSchema.CallToolResult({
    content: [{ type: "text", text: JSON.stringify(value) }],
    isError,
  });

/** The caller of the current MCP request; the route middleware has already rejected anyone else. */
const currentCaller = (auth: Auth["Service"]) =>
  Effect.gen(function* () {
    const request = yield* Effect.serviceOption(HttpServerRequest.HttpServerRequest);
    if (Option.isNone(request)) {
      return yield* new McpSchema.InternalError({ message: "MCP tools are only served over HTTP" });
    }
    return yield* auth
      .apiKey(request.value)
      .pipe(Effect.mapError(() => new McpSchema.InternalError({ message: "The API key is no longer accepted." })));
  });

const annotationsFor = (operation: SummonOperation): McpSchema.ToolAnnotations => ({
  readOnlyHint: operation.tool === "read",
  destructiveHint: operation.method === "DELETE",
  idempotentHint: operation.method !== "POST",
  openWorldHint: false,
});

const SummonTools = Layer.effectDiscard(
  Effect.gen(function* () {
    const server = yield* McpServer.McpServer;
    const django = yield* Django;
    const auth = yield* Auth;
    const all: Readonly<Record<string, SummonOperation>> = operations;
    for (const [name, operation] of Object.entries(all)) {
      yield* server.addTool({
        tool: new McpSchema.Tool({
          name,
          description: operation.description,
          inputSchema: operation.inputSchema as McpSchema.ToolJson,
          annotations: annotationsFor(operation),
        }),
        annotations: Context.empty(),
        handle: (input: Readonly<Record<string, unknown>>) =>
          Effect.gen(function* () {
            const caller: ApiKeyCaller = yield* currentCaller(auth);
            const result = yield* django
              .call(caller, caller.workspaceSlug, operation, input ?? {})
              .pipe(
                Effect.mapError(() => new McpSchema.InternalError({ message: "Summon is unavailable. Try again." }))
              );
            const output = toToolOutput(result);
            if (!output.ok || !("data" in output)) return jsonResult(output, !output.ok);
            // A 204 (delete) has no body; say it worked instead of returning `null`.
            return jsonResult(output.data ?? { ok: true }, false);
          }),
      });
    }
  })
);

const PlaneTools = Layer.effectDiscard(
  Effect.gen(function* () {
    const server = yield* McpServer.McpServer;
    const plane = yield* PlaneMcp;
    const auth = yield* Auth;
    for (const tool of planeTools) {
      yield* server.addTool({
        tool: new McpSchema.Tool({
          name: `${PLANE_TOOL_PREFIX}${tool.name}`,
          ...(tool.description ? { description: tool.description } : {}),
          inputSchema: tool.inputSchema as McpSchema.ToolJson,
        }),
        annotations: Context.empty(),
        handle: (input: Readonly<Record<string, unknown>>) =>
          Effect.gen(function* () {
            const caller = yield* currentCaller(auth);
            const result = yield* plane
              .callTool(caller, tool.name, input ?? {})
              .pipe(
                Effect.mapError(() => new McpSchema.InternalError({ message: "Plane is unavailable. Try again." }))
              );
            // Plane's own CallToolResult passes through unchanged.
            return yield* Schema.decodeUnknownEffect(McpSchema.CallToolResult)(result).pipe(
              Effect.mapError(() => new McpSchema.InternalError({ message: "Plane returned an invalid tool result." }))
            );
          }),
      });
    }
  })
);

/** Refuses MCP requests without an accepted API key before they reach the MCP session machinery. */
const RequireApiKey = HttpRouter.middleware(
  Effect.gen(function* () {
    const auth = yield* Auth;
    return (httpEffect) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        yield* auth.apiKey(request);
        return yield* httpEffect;
      }).pipe(
        Effect.catchTags({
          Unauthenticated: (error) =>
            Effect.succeed(
              HttpServerResponse.jsonUnsafe(
                {
                  error_code: error.reason === "missing_credentials" ? "api_key_required" : "api_key_rejected",
                  message: "Send a Plane API key (X-Api-Key) and the workspace slug (X-Workspace-Slug).",
                },
                { status: 401 }
              )
            ),
          RateLimited: () =>
            Effect.succeed(HttpServerResponse.jsonUnsafe({ error_code: "rate_limited" }, { status: 429 })),
          DjangoUnavailable: () =>
            Effect.succeed(HttpServerResponse.jsonUnsafe({ error_code: "summon_unavailable" }, { status: 502 })),
        })
      );
  })
).layer;

export const McpRoutes = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* AppConfig;
    return Layer.mergeAll(SummonTools, PlaneTools).pipe(
      Layer.provideMerge(
        McpServer.layerHttp({
          name: "summon",
          version: config.version,
          instructions: INSTRUCTIONS,
          path: MCP_PATH,
          protocols: [
            McpProtocol.v2026_07_28,
            McpProtocol.v2025_11_25,
            McpProtocol.v2025_06_18,
            McpProtocol.v2025_03_26,
          ],
        })
      ),
      Layer.provide(RequireApiKey)
    );
  })
);
