/**
 * Who is calling. Browser requests carry the Django session cookie (same origin through Caddy);
 * MCP clients send a Plane API key and the workspace slug, like the Plane MCP server expects.
 * Django stays the judge: we only ask it, and cache a yes for 30 s so tool calls don't re-ask.
 */
import { Cache, Context, Duration, Effect, Exit, Layer, Option, Redacted, Schema } from "effect";
import type { HttpServerRequest } from "effect/http";
import { AppConfig } from "./config";
import { type Caller, Django, DjangoUnavailable } from "./django";

export class Unauthenticated extends Schema.TaggedError<Unauthenticated>()("Unauthenticated", {
  reason: Schema.Literals(["missing_credentials", "rejected"]),
}) {}

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
  ) => Effect.Effect<ApiKeyCaller, Unauthenticated | DjangoUnavailable>;
}

/** `X-Api-Key`, or `Authorization: Bearer` as MCP clients usually send it. */
export const readApiKey = (headers: Readonly<Record<string, string | undefined>>): string | undefined => {
  const key = headers["x-api-key"];
  if (key) return key;
  const authorization = headers.authorization;
  return authorization?.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() || undefined : undefined;
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
      const keys = yield* Cache.makeWith(
        (entry: string) => {
          const [workspaceSlug, apiKey] = splitKeyEntry(entry);
          return django
            .client({ _tag: "ApiKey", apiKey: Redacted.make(apiKey), workspaceSlug })
            .accessMe(workspaceSlug, undefined)
            .pipe(
              Effect.as<true | undefined>(true),
              Effect.catch((error) =>
                error._tag === "HttpClientError" && REJECTED.has(error.response?.status ?? 0)
                  ? Effect.succeed(undefined)
                  : Effect.fail(new DjangoUnavailable({ cause: error }))
              )
            );
        },
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
        const workspaceSlug = request.headers["x-workspace-slug"];
        if (!key || !workspaceSlug) return yield* new Unauthenticated({ reason: "missing_credentials" });
        const accepted = yield* Cache.get(keys, keyEntry(workspaceSlug, key));
        if (!accepted) return yield* new Unauthenticated({ reason: "rejected" });
        return { _tag: "ApiKey", apiKey: Redacted.make(key), workspaceSlug } as const;
      });

      return Auth.of({ session, apiKey });
    })
  );
}

const keyEntry = (workspaceSlug: string, apiKey: string) => `${workspaceSlug}\u0000${apiKey}`;
const splitKeyEntry = (entry: string): [string, string] => {
  const index = entry.indexOf("\u0000");
  return [entry.slice(0, index), entry.slice(index + 1)];
};
