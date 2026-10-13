/**
 * Django is the source of truth: every read, write and permission check is a Django call made as the
 * caller (their session cookie, or their Plane API key for MCP). This service never sees Postgres.
 */
import { SummonClient, type SummonOperation } from "@plane/summon-contract";
import { Context, Effect, flow, Layer, Redacted, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";
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
   * (`AIServicePermission`); only the chat route uses it, never MCP.
   */
  readonly client: (caller: Caller, options?: { readonly aiService?: boolean }) => SummonClient.SummonClient;
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
}

const AI_TOKEN_HEADER = "x-summon-ai-token";

const authHeaders = (caller: Caller): Record<string, string> =>
  caller._tag === "Session" ? { cookie: caller.cookie } : { "x-api-key": Redacted.value(caller.apiKey) };

/** Fills `{name}` segments of an OpenAPI path template. */
export const fillPath = (template: string, values: Readonly<Record<string, unknown>>): string =>
  template.replace(/\{(\w+)\}/g, (_, name: string) => encodeURIComponent(String(values[name] ?? "")));

/** Splits tool input into path, query and body the way the manifest describes the operation. */
export const operationRequest = (
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

      const client: DjangoShape["client"] = (caller, options) =>
        SummonClient.make(
          withHeaders({
            ...authHeaders(caller),
            ...(options?.aiService ? { [AI_TOKEN_HEADER]: Redacted.value(config.internalToken) } : {}),
          })
        );

      const call: DjangoShape["call"] = (caller, workspaceSlug, operation, input) =>
        withHeaders(authHeaders(caller))
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

      return Django.of({
        client,
        internal: SummonClient.make(withHeaders({ [AI_TOKEN_HEADER]: Redacted.value(config.internalToken) })),
        call,
        currentUser,
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
