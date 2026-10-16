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
 *
 * Like GitHub's MCP server, clients can load less: `/ai/mcp/x/<toolset>` serves one group (a Django view
 * module such as `commercial`, or `plane`), and a `/readonly` suffix on either drops every write.
 */
import { operations, type SummonOperation } from "@plane/summon-contract";
import { Context, Effect, Layer, Option, Schema } from "effect";
import { McpProtocol, McpSchema, McpServer } from "effect/ai";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { Auth, type ApiKeyCaller } from "./auth";
import { AppConfig } from "./config";
import { Django } from "./django";
import { isReadAction, PlaneMcp, planeActions, planeTools, withoutActions } from "./plane-mcp";
import { toolInputSchema, toToolOutput } from "./tools";

export const MCP_PATH = "/ai/mcp" as const;
export const PLANE_TOOL_PREFIX = "plane_";
const PLANE_TOOLSET = "plane";

/** One MCP endpoint: every tool or one toolset, optionally without writes. */
interface Surface {
  readonly path: `/${string}`;
  readonly toolset: string | undefined;
  readonly readOnly: boolean;
}

const allOperations: Readonly<Record<string, SummonOperation>> = operations;
export const TOOLSETS = [
  ...new Set([...Object.values(allOperations).map((operation) => operation.toolset), PLANE_TOOLSET]),
].toSorted();

export const SURFACES: ReadonlyArray<Surface> = [undefined, ...TOOLSETS].flatMap((toolset) => {
  const path: Surface["path"] = toolset ? `${MCP_PATH}/x/${toolset}` : MCP_PATH;
  return [
    { path, toolset, readOnly: false },
    { path: `${path}/readonly`, toolset, readOnly: true },
  ];
});

const INSTRUCTIONS =
  "Summon is a project delivery workspace on Plane. Summon tools (clients, opportunities, meetings, " +
  "automation, reports) and Plane tools (prefixed plane_: projects, work items, cycles, …) act as the " +
  "API key's user in the X-Workspace-Slug workspace. Tools marked read-only never change data. List tools " +
  "return one page: pass `offset: next_offset` for the next.";

const jsonResult = (value: unknown, isError: boolean) =>
  new McpSchema.CallToolResult({
    content: [{ type: "text", text: JSON.stringify(value) }],
    isError,
  });

/** The API key's caller, which `RequireApiKey` checked before the request reached the MCP server. */
class McpCaller extends Context.Service<McpCaller, ApiKeyCaller>()("@plane/ai/McpCaller") {}

/**
 * The request's caller, read at runtime: tool handlers run in the request fiber, but `addTool` types them as
 * needing only `McpRequestContext`, so the service can't be a typed requirement.
 */
const currentCaller = Effect.serviceOption(McpCaller).pipe(
  Effect.flatMap(
    Option.match({
      onNone: () => Effect.fail(new McpSchema.InternalError({ message: "MCP tools are only served over HTTP" })),
      onSome: Effect.succeed,
    })
  )
);

const annotationsFor = (operation: SummonOperation): McpSchema.ToolAnnotations => ({
  readOnlyHint: operation.tool === "read",
  destructiveHint: operation.method === "DELETE",
  idempotentHint: operation.method !== "POST",
  openWorldHint: false,
});

/** What Plane said went wrong, without Plane's own text: an upstream body is not something the model should read. */
const PLANE_REFUSALS: Readonly<Record<number, string>> = {
  400: "Plane rejected the arguments. Check them against this tool's input schema.",
  401: "Plane refused this API key.",
  403: "This API key may not do that in Plane.",
  404: "Not found, or not available on this Plane.",
  409: "It already exists or changed meanwhile. Read it again, then retry.",
  429: "Plane is rate limiting this key. Wait, then retry.",
};

const planeError = (text: string) => {
  const status = Number(/\b([45]\d\d)\b/.exec(text)?.[1] ?? 0);
  const message = PLANE_REFUSALS[status] ?? "Plane couldn't complete the call. Try again.";
  return jsonResult({ ok: false, ...(status ? { status } : {}), message }, true);
};

const SummonTools = (surface: Surface) =>
  Layer.effectDiscard(
    Effect.gen(function* () {
      const server = yield* McpServer.McpServer;
      const django = yield* Django;
      for (const [name, operation] of Object.entries(allOperations)) {
        if (surface.toolset && operation.toolset !== surface.toolset) continue;
        if (surface.readOnly && operation.tool !== "read") continue;
        yield* server.addTool({
          tool: new McpSchema.Tool({
            name,
            title: operation.title,
            description: operation.description,
            inputSchema: toolInputSchema(operation) as McpSchema.ToolJson,
            annotations: annotationsFor(operation),
          }),
          annotations: Context.empty(),
          handle: (input: Readonly<Record<string, unknown>>) =>
            Effect.gen(function* () {
              const caller = yield* currentCaller;
              const result = yield* django
                .call(caller, caller.workspaceSlug, operation, input ?? {})
                .pipe(
                  Effect.mapError(() => new McpSchema.InternalError({ message: "Summon is unavailable. Try again." }))
                );
              const output = toToolOutput(result, operation, input ?? {});
              if (!output.ok || !("data" in output)) return jsonResult(output, !output.ok);
              // A 204 (delete) has no body; say it worked instead of returning `null`.
              return jsonResult(output.data ?? { ok: true }, false);
            }),
        });
      }
    })
  );

const PlaneTools = (surface: Surface) =>
  Layer.effectDiscard(
    Effect.gen(function* () {
      if (surface.toolset && surface.toolset !== PLANE_TOOLSET) return;
      const server = yield* McpServer.McpServer;
      const plane = yield* PlaneMcp;
      for (const planeTool of planeTools) {
        const writes = planeActions(planeTool).filter((action) => !isReadAction(action));
        const tool = surface.readOnly ? withoutActions(planeTool, writes) : planeTool;
        const actions = planeActions(tool);
        const title = `Plane ${tool.name.replaceAll("_", " ")}`;
        yield* server.addTool({
          tool: new McpSchema.Tool({
            name: `${PLANE_TOOL_PREFIX}${tool.name}`,
            title,
            ...(tool.description ? { description: tool.description } : {}),
            inputSchema: tool.inputSchema as McpSchema.ToolJson,
            // One Plane tool bundles reads and writes behind `action`, so the hints describe the whole set.
            annotations: {
              readOnlyHint: actions.every(isReadAction),
              destructiveHint: actions.includes("delete"),
              idempotentHint: false,
              openWorldHint: false,
            },
          }),
          annotations: Context.empty(),
          handle: (input: Readonly<Record<string, unknown>>) =>
            Effect.gen(function* () {
              if (!actions.includes(String(input?.action))) {
                return jsonResult({ ok: false, message: `Use one of these actions: ${actions.join(", ")}.` }, true);
              }
              const caller = yield* currentCaller;
              const result = yield* plane
                .callTool(caller, tool.name, input)
                .pipe(
                  Effect.mapError(() => new McpSchema.InternalError({ message: "Plane is unavailable. Try again." }))
                );
              const decoded = yield* Schema.decodeUnknownEffect(McpSchema.CallToolResult)(result).pipe(
                Effect.mapError(
                  () => new McpSchema.InternalError({ message: "Plane returned an invalid tool result." })
                )
              );
              // Plane also reports some failures as plain "Error…" text without `isError`.
              const first = decoded.content[0];
              const text = first?.type === "text" ? first.text : "";
              return decoded.isError || text.startsWith("Error") ? planeError(text) : decoded;
            }),
        });
      }
    })
  );

const MISSING_KEY = "Send a Plane API key (X-Api-Key) and the workspace slug (X-Workspace-Slug).";

/** Refuses MCP requests without an accepted API key before they reach the MCP session machinery. */
const RequireApiKey = HttpRouter.middleware<{ provides: McpCaller }>()(
  Effect.gen(function* () {
    const auth = yield* Auth;
    return (httpEffect) =>
      Effect.gen(function* () {
        const caller = yield* auth.apiKey(yield* HttpServerRequest.HttpServerRequest);
        return yield* Effect.provideService(httpEffect, McpCaller, caller);
      }).pipe(
        Effect.catchTags({
          Unauthenticated: (error) =>
            Effect.succeed(
              HttpServerResponse.jsonUnsafe(
                {
                  error_code: error.reason === "missing_credentials" ? "api_key_required" : "api_key_rejected",
                  message: MISSING_KEY,
                },
                {
                  status: 401,
                  // Says how to authenticate, so a client doesn't look for an OAuth server Summon doesn't run.
                  headers: {
                    "www-authenticate": `Bearer realm="summon", error="invalid_token", error_description="${MISSING_KEY}"`,
                  },
                }
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
    const [first, ...rest] = SURFACES.map((surface) =>
      Layer.mergeAll(SummonTools(surface), PlaneTools(surface)).pipe(
        Layer.provide(
          Layer.fresh(
            McpServer.layerHttp({
              name: "summon",
              version: config.version,
              instructions: INSTRUCTIONS,
              path: surface.path,
              protocols: [
                McpProtocol.v2026_07_28,
                McpProtocol.v2025_11_25,
                McpProtocol.v2025_06_18,
                McpProtocol.v2025_03_26,
              ],
            })
          )
        )
      )
    );
    return Layer.mergeAll(first!, ...rest).pipe(Layer.provide(RequireApiKey));
  })
);
