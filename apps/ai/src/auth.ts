/**
 * Who is calling. Browser requests carry the Django session cookie (same origin through Caddy);
 * MCP clients send a Plane API key and the workspace slug, like the Plane MCP server expects, or just the
 * access token they got by signing in with OAuth (a Plane API key that names its workspace).
 * Django stays the judge: we only ask it, and cache a yes for 30 s so tool calls don't re-ask.
 */
import { Cache, Context, Duration, Effect, Exit, Layer, Option, Redacted, Schema } from "effect";
import { HttpClientError, type HttpServerRequest } from "effect/http";
import { AppConfig } from "./config";
import { type Caller, Django, DjangoUnavailable } from "./django";

export class Unauthenticated extends Schema.TaggedError<Unauthenticated>()("Unauthenticated", {
  reason: Schema.Literals(["missing_credentials", "rejected"]),
}) {}

/** Django throttled the API key; the client should back off rather than treat Summon as down. */
export class RateLimited extends Schema.TaggedError<RateLimited>()("RateLimited", {}) {}

/** A cookie-authenticated request from another origin: refused so the session can't be used cross-site. */
export class ForbiddenOrigin extends Schema.TaggedError<ForbiddenOrigin>()("ForbiddenOrigin", {}) {}

export type SessionCaller = Extract<Caller, { _tag: "Session" }>;
export type ApiKeyCaller = Extract<Caller, { _tag: "ApiKey" }>;

const SUCCESS_TTL = Duration.seconds(30);
/** Django's answers for a key it does not accept for the workspace. */
const REJECTED = new Set([401, 403, 404]);

export interface AuthShape {
  readonly session: (
    request: HttpServerRequest.HttpServerRequest
  ) => Effect.Effect<SessionCaller, Unauthenticated | ForbiddenOrigin | DjangoUnavailable>;
  readonly apiKey: (
    request: HttpServerRequest.HttpServerRequest
  ) => Effect.Effect<ApiKeyCaller, Unauthenticated | RateLimited | DjangoUnavailable>;
}

/** `X-Api-Key`, or `Authorization: Bearer` as MCP clients usually send it. */
export const readApiKey = (headers: Readonly<Record<string, string | undefined>>): string | undefined => {
  const key = headers["x-api-key"];
  if (key) return key;
  const authorization = headers.authorization;
  return authorization?.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() || undefined : undefined;
};

/** Django's refusal of a key as "not accepted" (`undefined`); throttling and outages stay errors. */
const refusal = (error: unknown): Effect.Effect<undefined, RateLimited | DjangoUnavailable> => {
  const status = error instanceof HttpClientError.HttpClientError ? error.response?.status : undefined;
  if (status === 429) return Effect.fail(new RateLimited());
  return status !== undefined && REJECTED.has(status)
    ? Effect.succeed(undefined)
    : Effect.fail(error instanceof DjangoUnavailable ? error : new DjangoUnavailable({ cause: error }));
};

export class Auth extends Context.Service<Auth, AuthShape>()("@plane/ai/Auth") {
  static readonly layer = Layer.effect(
    Auth,
    Effect.gen(function* () {
      const config = yield* AppConfig;
      const django = yield* Django;
      // Only successes are cached: a rejected cookie or key is re-checked on the next request.
      const ttl = (exit: Exit.Exit<unknown, unknown>) =>
        Exit.isSuccess(exit) && exit.value !== undefined ? SUCCESS_TTL : Duration.zero;

      const users = yield* Cache.makeWith((cookie: string) => django.currentUser(cookie), {
        capacity: 10_000,
        timeToLive: ttl,
      });
      // Key + workspace → whether Django accepts the key for that workspace (`SummonAPIKeyAuthentication`).
      // Plain-object keys compare structurally.
      const keys = yield* Cache.makeWith(
        ({ workspaceSlug, apiKey }: { readonly workspaceSlug: string; readonly apiKey: string }) =>
          django
            .client({ _tag: "ApiKey", apiKey: Redacted.make(apiKey), workspaceSlug })
            .accessMe(workspaceSlug, undefined)
            .pipe(Effect.as<true | undefined>(true), Effect.catch(refusal)),
        { capacity: 10_000, timeToLive: ttl }
      );
      // Key → its workspace, for OAuth clients that send no X-Workspace-Slug.
      const workspaces = yield* Cache.makeWith(
        (apiKey: string) => django.apiKeyWorkspace(apiKey).pipe(Effect.catch(refusal)),
        { capacity: 10_000, timeToLive: ttl }
      );

      const session: AuthShape["session"] = Effect.fn("Auth.session")(function* (request) {
        const origin = request.headers.origin;
        if (origin && Option.isSome(config.webOrigin) && origin !== config.webOrigin.value) {
          return yield* new ForbiddenOrigin();
        }
        const cookie = request.headers.cookie;
        if (!cookie) return yield* new Unauthenticated({ reason: "missing_credentials" });
        const user = yield* Cache.get(users, cookie);
        if (!user) return yield* new Unauthenticated({ reason: "rejected" });
        return { _tag: "Session", cookie, userId: user.id } as const;
      });

      const apiKey: AuthShape["apiKey"] = Effect.fn("Auth.apiKey")(function* (request) {
        const key = readApiKey(request.headers);
        if (!key) return yield* new Unauthenticated({ reason: "missing_credentials" });
        const workspaceSlug = request.headers["x-workspace-slug"] || (yield* Cache.get(workspaces, key));
        if (!workspaceSlug) return yield* new Unauthenticated({ reason: "rejected" });
        const accepted = yield* Cache.get(keys, { workspaceSlug, apiKey: key });
        if (!accepted) return yield* new Unauthenticated({ reason: "rejected" });
        return { _tag: "ApiKey", apiKey: Redacted.make(key), workspaceSlug } as const;
      });

      return Auth.of({ session, apiKey });
    })
  );
}
