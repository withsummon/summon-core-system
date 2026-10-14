/**
 * Assistant tools. Every Summon read Django marks `x-summon-tool: read` becomes a tool, with the
 * input schema and description generated from the Django serializers (`@plane/summon-contract`).
 * Writes go through the `plane` tool, which Django turns into a pending action the user confirms;
 * the model never changes data on its own.
 */
import { operations, type SummonClient, type SummonOperation } from "@plane/summon-contract";
import { jsonSchema, type JSONSchema7, tool, type ToolSet } from "ai";
import { Effect, type Schema } from "effect";
import type { Caller, DjangoShape, OperationResult } from "./django";

/** Tool output is capped so one large list can't fill the context window (full data stays in Summon). */
export const MAX_TOOL_OUTPUT_CHARS = 50_000;

/** List tools answer one page at a time, so a large workspace can't flood the context window. */
export const LIST_PAGE_SIZE = 50;
const MAX_LIST_PAGE_SIZE = 200;

export type ToolOutput =
  | { readonly ok: true; readonly data: unknown }
  | { readonly ok: true; readonly truncated: true; readonly preview: string }
  | { readonly ok: false; readonly status: number; readonly error: unknown };

/** The input schema a tool advertises: list tools also take `limit` and `offset`. */
export const toolInputSchema = (operation: SummonOperation): SummonOperation["inputSchema"] => {
  if (!operation.list) return operation.inputSchema;
  const properties = operation.inputSchema.properties as Readonly<Record<string, unknown>>;
  return {
    ...operation.inputSchema,
    properties: {
      ...properties,
      limit: {
        type: "integer",
        minimum: 1,
        maximum: MAX_LIST_PAGE_SIZE,
        description: `How many to return (default ${LIST_PAGE_SIZE}).`,
      },
      offset: { type: "integer", minimum: 0, description: "How many to skip: the previous page's `next_offset`." },
    },
  };
};

/**
 * Django's answer as a tool result. A list comes back as one page with `total` and `next_offset`. An error
 * body that isn't DRF's JSON (an HTML error page) is replaced by a code, so the model never reads raw pages.
 */
export const toToolOutput = (
  result: OperationResult,
  operation?: SummonOperation,
  input: Readonly<Record<string, unknown>> = {}
): ToolOutput => {
  if (result.status >= 400) {
    const error =
      typeof result.body === "object" && result.body !== null
        ? result.body
        : { error_code: result.status >= 500 ? "summon_error" : "invalid_request" };
    return { ok: false, status: result.status, error };
  }
  const data = operation?.list && Array.isArray(result.body) ? page(result.body, input) : result.body;
  const text = JSON.stringify(data ?? null);
  return text.length > MAX_TOOL_OUTPUT_CHARS
    ? { ok: true, truncated: true, preview: text.slice(0, MAX_TOOL_OUTPUT_CHARS) }
    : { ok: true, data };
};

const page = (items: ReadonlyArray<unknown>, input: Readonly<Record<string, unknown>>) => {
  const limit = Math.min(Math.max(Number(input.limit) || LIST_PAGE_SIZE, 1), MAX_LIST_PAGE_SIZE);
  const offset = Math.max(Number(input.offset) || 0, 0);
  const end = offset + limit;
  return { results: items.slice(offset, end), total: items.length, next_offset: end < items.length ? end : null };
};

const unavailable: ToolOutput = { ok: false, status: 503, error: { error_code: "summon_unavailable" } };

const allOperations: Readonly<Record<string, SummonOperation>> = operations;
export const readOperations = Object.entries(allOperations).filter(([, operation]) => operation.tool === "read");

const PLANE_TOOL_NAMES = ["project", "workitem", "workitem_comment", "cycle", "module", "state", "label", "member"];

export interface ToolDeps {
  readonly django: DjangoShape;
  readonly caller: Caller;
  readonly workspaceSlug: string;
  readonly conversationId: string;
  /** Runs an effect from inside an AI SDK callback, with the request's services. */
  readonly run: <A>(effect: Effect.Effect<A>, signal?: AbortSignal) => Promise<A>;
  /** Called when the model proposed a Plane write; the chat route streams it as a `data-action` part. */
  readonly onAction: (action: SummonClient.AssistantAction) => void;
}

export const assistantTools = (deps: ToolDeps): ToolSet => {
  const tools: ToolSet = {};
  for (const [name, operation] of readOperations) {
    tools[name] = tool({
      description: operation.description,
      inputSchema: jsonSchema<Record<string, unknown>>(toolInputSchema(operation) as JSONSchema7),
      execute: (input, { abortSignal }) =>
        deps.run(
          deps.django.call(deps.caller, deps.workspaceSlug, operation, input).pipe(
            Effect.map((result) => toToolOutput(result, operation, input)),
            Effect.catchTag("DjangoUnavailable", () => Effect.succeed(unavailable))
          ),
          abortSignal
        ),
    });
  }

  tools.plane = tool({
    description:
      "Use Plane through this conversation's Plane connection: projects, work items and their comments, cycles, " +
      "modules, states, labels and members. Reads (list, retrieve, search) return data now. Creates and " +
      "updates are queued as an action the user must confirm in the app; say so instead of claiming they are done.",
    inputSchema: jsonSchema<{ tool: string; arguments: Schema.JsonObject }>({
      type: "object",
      properties: {
        tool: { type: "string", enum: PLANE_TOOL_NAMES },
        arguments: {
          type: "object",
          description: "Plane MCP arguments, including `action` (e.g. list, retrieve, search, create, update).",
          properties: { action: { type: "string" } },
          required: ["action"],
        },
      },
      required: ["tool", "arguments"],
      additionalProperties: false,
    }),
    execute: (input, { abortSignal }) =>
      deps.run(
        deps.django
          .client(deps.caller, { aiService: true })
          .assistantPlaneToolCall(deps.workspaceSlug, deps.conversationId, {
            payload: { tool: input.tool, arguments: input.arguments },
            config: { includeResponse: true },
          })
          .pipe(
            Effect.map(([body, response]): ToolOutput => {
              if (body.action) {
                deps.onAction(body.action);
                return {
                  ok: true,
                  data: { status: "pending_confirmation", action_id: body.action.id, preview: body.action.preview },
                };
              }
              return toToolOutput({ status: response.status, body: body.result });
            }),
            Effect.catchTags({
              // Django refused the call (no Plane connection, MCP down): the model gets the code and can say so.
              AssistantPlaneToolCall503: (error) =>
                Effect.succeed<ToolOutput>({ ok: false, status: 503, error: error.cause }),
              HttpClientError: (error) =>
                Effect.succeed<ToolOutput>(
                  error.reason._tag === "StatusCodeError"
                    ? { ok: false, status: error.reason.response.status, error: error.reason.description }
                    : unavailable
                ),
              SchemaError: () => Effect.succeed(unavailable),
            })
          ),
        abortSignal
      ),
  });
  return tools;
};
