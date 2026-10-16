/**
 * Django is the source of truth: every read, write and permission check is a Django call made as the
 * caller (their session cookie, or their Plane API key for MCP). This service never sees Postgres.
 */
import { SummonClient, type SummonOperation } from "@plane/summon-contract";
import { Context, Effect, flow, Layer, Redacted, Schema } from "effect";
import { HttpClient, type HttpClientError, HttpClientRequest, HttpClientResponse } from "effect/http";
import { AppConfig } from "./config";

/** Who a Django call is made for. Django applies its own permission classes to it. */
export type Caller =
  | { readonly _tag: "Session"; readonly cookie: string; readonly userId: string }
  | { readonly _tag: "ApiKey"; readonly apiKey: Redacted.Redacted<string>; readonly workspaceSlug: string };

export class DjangoUnavailable extends Schema.TaggedError<DjangoUnavailable>()("DjangoUnavailable", {
  cause: Schema.Defect(),
}) {}

/** A Summon endpoint's answer, passed to the model or MCP client as data (including 4xx bodies). */
export interface OperationResult {
  readonly status: number;
  readonly body: unknown;
}

export const CurrentUser = Schema.Struct({
  id: Schema.String,
  email: Schema.optionalKey(Schema.String),
  display_name: Schema.optionalKey(Schema.String),
});
export type CurrentUser = typeof CurrentUser.Type;

export interface DjangoShape {
  /**
   * Typed Summon client for `caller`. `aiService` adds the internal token the turn protocol requires
   * (`AIServicePermission`); only the chat route uses it, never MCP. `transform` wraps the HTTP client
   * (e.g. `HttpClient.retryTransient`).
   */
  readonly client: (
    caller: Caller,
    options?: {
      readonly aiService?: boolean;
      readonly transform?: (client: HttpClient.HttpClient) => HttpClient.HttpClient;
    }
  ) => SummonClient.SummonClient;
  /** Token-only client for `internal/*` endpoints (no user). */
  readonly internal: SummonClient.SummonClient;
  /** Calls a tool operation from the generated manifest with model- or MCP-supplied input. */
  readonly call: (
    caller: Caller,
    workspaceSlug: string,
    operation: SummonOperation,
    input: Readonly<Record<string, unknown>>
  ) => Effect.Effect<OperationResult, DjangoUnavailable>;
  /** Resolves a session cookie to its user; `undefined` when Django doesn't accept the cookie. */
  readonly currentUser: (cookie: string) => Effect.Effect<CurrentUser | undefined, DjangoUnavailable>;
  /**
   * The workspace an API key belongs to (OAuth access tokens always have one). `undefined` when Django
   * refuses the key or it has no workspace; Django's answer otherwise, including a 429.
   */
  readonly apiKeyWorkspace: (
    apiKey: string
  ) => Effect.Effect<string | undefined, DjangoUnavailable | HttpClientError.HttpClientError>;
}

const ApiKeyWorkspace = Schema.Struct({ workspace_slug: Schema.String });

const AI_TOKEN_HEADER = "x-summon-ai-token";

const authHeaders = (caller: Caller): Record<string, string> =>
  caller._tag === "Session" ? { cookie: caller.cookie } : { "x-api-key": Redacted.value(caller.apiKey) };

/** Fills `{name}` segments of an OpenAPI path template. */
const fillPath = (template: string, values: Readonly<Record<string, unknown>>): string =>
  template.replace(/\{(\w+)\}/g, (_, name: string) => encodeURIComponent(String(values[name])));

/** Path parameters the input leaves out, as a DRF-shaped 400 body; Django can't route the call without them. */
const missingPathParams = (operation: SummonOperation, input: Readonly<Record<string, unknown>>) => {
  const missing = operation.pathParams.filter(
    (name) => name !== "slug" && (input[name] === undefined || input[name] === null || input[name] === "")
  );
  return missing.length ? Object.fromEntries(missing.map((name) => [name, ["This field is required."]])) : undefined;
};

/** Splits tool input into path, query and body the way the manifest describes the operation. */
const operationRequest = (
  operation: SummonOperation,
  workspaceSlug: string,
  input: Readonly<Record<string, unknown>>
): HttpClientRequest.HttpClientRequest => {
  const url = fillPath(operation.path, { ...input, slug: workspaceSlug });
  const query: Record<string, string> = {};
  for (const name of operation.queryParams) {
    const value = input[name];
    if (value !== undefined && value !== null) query[name] = String(value);
  }
  let request = HttpClientRequest.make(operation.method)(url).pipe(HttpClientRequest.setUrlParams(query));
  if (operation.body === "flat") {
    const routed = new Set([...operation.pathParams, ...operation.queryParams]);
    request = HttpClientRequest.bodyJsonUnsafe(
      request,
      Object.fromEntries(Object.entries(input).filter(([name]) => !routed.has(name)))
    );
  } else if (operation.body === "nested") {
    request = HttpClientRequest.bodyJsonUnsafe(request, input.body ?? {});
  }
  return request;
};

export class Django extends Context.Service<Django, DjangoShape>()("@plane/ai/Django") {
  static readonly layer = Layer.effect(
    Django,
    Effect.gen(function* () {
      const config = yield* AppConfig;
      const http = (yield* HttpClient.HttpClient).pipe(
        HttpClient.mapRequest(flow(HttpClientRequest.prependUrl(config.djangoUrl), HttpClientRequest.acceptJson))
      );
      const withHeaders = (headers: Record<string, string>) =>
        http.pipe(HttpClient.mapRequest(HttpClientRequest.setHeaders(headers)));

      const client: DjangoShape["client"] = (caller, options) => {
        const summon = withHeaders({
          ...authHeaders(caller),
          ...(options?.aiService ? { [AI_TOKEN_HEADER]: Redacted.value(config.internalToken) } : {}),
        });
        return SummonClient.make(options?.transform ? options.transform(summon) : summon);
      };

      const call: DjangoShape["call"] = (caller, workspaceSlug, operation, input) => {
        const missing = missingPathParams(operation, input);
        if (missing) return Effect.succeed({ status: 400, body: missing });
        return withHeaders(authHeaders(caller))
          .execute(operationRequest(operation, workspaceSlug, input))
          .pipe(
            Effect.flatMap((response) =>
              response.text.pipe(
                Effect.map((text): OperationResult => ({ status: response.status, body: parseBody(text) }))
              )
            ),
            Effect.mapError((cause) => new DjangoUnavailable({ cause })),
            Effect.withSpan("Django.call", { attributes: { operation: operation.path, method: operation.method } })
          );
      };

      const currentUser: DjangoShape["currentUser"] = (cookie) =>
        withHeaders({ cookie })
          .get("/api/users/me/")
          .pipe(
            Effect.flatMap((response) => {
              if (response.status === 401 || response.status === 403) return Effect.succeed(undefined);
              return HttpClientResponse.filterStatusOk(response).pipe(
                Effect.flatMap(HttpClientResponse.schemaBodyJson(CurrentUser))
              );
            }),
            Effect.mapError((cause) => new DjangoUnavailable({ cause })),
            Effect.withSpan("Django.currentUser")
          );

      const apiKeyWorkspace: DjangoShape["apiKeyWorkspace"] = (apiKey) =>
        withHeaders({ "x-api-key": apiKey })
          .get("/api/summon/api-key/workspace/")
          .pipe(
            Effect.mapError((cause) => new DjangoUnavailable({ cause })),
            Effect.flatMap((response) => {
              if ([401, 403, 404].includes(response.status)) return Effect.succeed(undefined);
              return HttpClientResponse.filterStatusOk(response).pipe(
                Effect.flatMap(HttpClientResponse.schemaBodyJson(ApiKeyWorkspace)),
                Effect.map((body) => body.workspace_slug),
                Effect.catchTag("SchemaError", (cause) => Effect.fail(new DjangoUnavailable({ cause })))
              );
            }),
            Effect.withSpan("Django.apiKeyWorkspace")
          );

      return Django.of({
        client,
        internal: SummonClient.make(withHeaders({ [AI_TOKEN_HEADER]: Redacted.value(config.internalToken) })),
        call,
        currentUser,
        apiKeyWorkspace,
      });
    })
  );
}

const parseBody = (text: string): unknown => {
  if (text === "") return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};
