/**
 * Serves the real routes with `HttpRouter.toWebHandler`. Django and the Plane MCP server are a fake
 * `HttpClient`; the chat model is a `MockLanguageModelV4`. Everything between is production code.
 */
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import { Effect, Layer, Option, Redacted } from "effect";
import { HttpClient, HttpClientError, HttpClientResponse, HttpRouter } from "effect/http";
import { Routes } from "../src/app";
import { Auth } from "../src/auth";
import { AppConfig } from "../src/config";
import { Django } from "../src/django";
import { Models } from "../src/model";
import { PlaneMcp } from "../src/plane-mcp";

export const WEB_ORIGIN = "https://summon.test";
export const SLUG = "acme";
export const CONVERSATION_ID = "5f0a3c1e-2b1d-4c8e-9a51-0c3f1b2d4e6a";
export const USER_ID = "9b1c2d3e-4f50-4a6b-8c7d-0e1f2a3b4c5d";
export const AI_TOKEN = "test-ai-token";

export interface SeenRequest {
  readonly method: string;
  readonly path: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
}

/** Answers a Django request: a response, `undefined` for 404, or `"down"` for a transport failure. */
export type DjangoRoute = (request: SeenRequest) => { status: number; body?: unknown } | "down" | undefined;

type StreamPart =
  Awaited<ReturnType<MockLanguageModelV4["doStream"]>>["stream"] extends ReadableStream<infer Part> ? Part : never;

const message = (id: string, role: "user" | "assistant", content: string, status = "completed") => ({
  id,
  role,
  content,
  citations: [],
  provider: "",
  model: "",
  input_tokens: null,
  output_tokens: null,
  status,
  error_code: "",
  parts: [],
  usage: {},
  attachments: [],
  automation_job: null,
  created_at: "2026-10-14T08:00:00Z",
});

export const USER_MESSAGE_ID = "1a2b3c4d-0000-4000-8000-000000000001";
export const ASSISTANT_MESSAGE_ID = "1a2b3c4d-0000-4000-8000-000000000002";

export const turnResponse = {
  user_message: message(USER_MESSAGE_ID, "user", "What is at risk?"),
  assistant_message: message(ASSISTANT_MESSAGE_ID, "assistant", "", "streaming"),
  history: [{ role: "user", content: "What is at risk?" }],
  context: { text: "Project Website: 2 overdue work items.", citations: [], truncated: false },
};

/** Signed-in browser, an accepted API key in `acme`, and the turn protocol. */
export const defaultDjango: DjangoRoute = (request) => {
  if (request.path === "/api/users/me/") {
    return request.headers.cookie === "sessionid=valid"
      ? { status: 200, body: { id: USER_ID, email: "val@summon.test" } }
      : { status: 401, body: { detail: "Authentication credentials were not provided." } };
  }
  if (request.path === `/api/summon/workspaces/${SLUG}/access/me/`) {
    return request.headers["x-api-key"] === "plane_api_good"
      ? { status: 200, body: { role: 20, role_label: "Admin", capabilities: [] } }
      : { status: 403, body: { detail: "This API token belongs to a different workspace" } };
  }
  const turns = `/api/summon/workspaces/${SLUG}/assistant/conversations/${CONVERSATION_ID}/turns/`;
  if (request.path === turns && request.method === "POST") return { status: 201, body: turnResponse };
  if (request.path === `${turns}${ASSISTANT_MESSAGE_ID}/complete/`) {
    return { status: 200, body: message(ASSISTANT_MESSAGE_ID, "assistant", "done") };
  }
  return undefined;
};

const decodeBody = (body: unknown): unknown => {
  if (typeof body === "object" && body !== null && "_tag" in body && body._tag === "Uint8Array" && "body" in body) {
    const text = new TextDecoder().decode(body.body as Uint8Array);
    return text ? JSON.parse(text) : undefined;
  }
  return undefined;
};

export const fakeHttpClient = (route: DjangoRoute, seen: Array<SeenRequest>) =>
  HttpClient.make((request, url) =>
    Effect.gen(function* () {
      const entry: SeenRequest = {
        method: request.method,
        path: url.pathname,
        headers: request.headers as Record<string, string>,
        body: decodeBody(request.body),
      };
      seen.push(entry);
      const answer = route(entry);
      if (answer === "down") {
        return yield* new HttpClientError.HttpClientError({ reason: new HttpClientError.TransportError({ request }) });
      }
      const { status, body } = answer ?? { status: 404, body: { detail: "Not found." } };
      return HttpClientResponse.fromWeb(
        request,
        new Response(body === undefined ? null : JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        })
      );
    })
  );

/** A model that streams `text` in two deltas and finishes. */
export const textModel = (text: string) =>
  new MockLanguageModelV4({
    provider: "openrouter",
    modelId: "openai/gpt-5-mini",
    doStream: async () => ({
      stream: convertArrayToReadableStream<StreamPart>([
        { type: "stream-start", warnings: [] },
        { type: "text-start", id: "t1" },
        { type: "text-delta", id: "t1", delta: text.slice(0, 4) },
        { type: "text-delta", id: "t1", delta: text.slice(4) },
        { type: "text-end", id: "t1" },
        {
          type: "finish",
          finishReason: { unified: "stop", raw: "stop" },
          usage: {
            inputTokens: { total: 120, noCache: 20, cacheRead: 100, cacheWrite: 0 },
            outputTokens: { total: 9, text: 9, reasoning: 0 },
          },
        },
      ]),
    }),
  });

export interface TestApp {
  readonly fetch: (path: string, init?: RequestInit) => Promise<Response>;
  readonly seen: Array<SeenRequest>;
  readonly dispose: () => Promise<void>;
}

export const makeApp = (options: { django?: DjangoRoute; model?: MockLanguageModelV4 } = {}): TestApp => {
  const seen: Array<SeenRequest> = [];
  const config = Layer.succeed(
    AppConfig,
    AppConfig.of({
      djangoUrl: "http://django.internal",
      internalToken: Redacted.make(AI_TOKEN),
      planeMcpUrl: "http://plane-mcp.internal/mcp",
      webOrigin: Option.some(WEB_ORIGIN),
      port: 0,
      version: "test",
    })
  );
  const model = options.model ?? textModel("Two items are overdue.");
  const models = Layer.succeed(
    Models,
    Models.of({ chat: Effect.succeed({ model, provider: "openrouter", modelId: "openai/gpt-5-mini" }) })
  );
  const services = Layer.mergeAll(Auth.layer, models, PlaneMcp.layer).pipe(
    Layer.provideMerge(Django.layer),
    Layer.provideMerge(config),
    Layer.provide(Layer.succeed(HttpClient.HttpClient, fakeHttpClient(options.django ?? defaultDjango, seen)))
  );
  const { handler, dispose } = HttpRouter.toWebHandler(Routes.pipe(Layer.provideMerge(services)), {
    disableLogger: true,
  });
  return {
    fetch: (path, init) => handler(new Request(`http://ai.internal${path}`, init)),
    seen,
    dispose,
  };
};

/** Reads an AI SDK UI message stream (SSE) into its JSON chunks. */
export const readUIStream = async (response: Response): Promise<Array<Record<string, unknown>>> => {
  const text = await response.text();
  return text
    .split("\n")
    .filter((line) => line.startsWith("data: ") && line !== "data: [DONE]")
    .map((line) => JSON.parse(line.slice(6)) as Record<string, unknown>);
};
