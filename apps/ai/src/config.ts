import { Config, Context, Effect, Layer, Option, type Redacted } from "effect";

export interface AppConfigShape {
  /** Django, on the internal network (never through Caddy). */
  readonly djangoUrl: string;
  /** Shared secret for the turn protocol and `internal/ai-config/` (`SUMMON_AI_INTERNAL_TOKEN` in Django). */
  readonly internalToken: Redacted.Redacted<string>;
  /** The Plane MCP server's API-key route; the Summon MCP server proxies its tools. */
  readonly planeMcpUrl: string;
  /** The web app's origin. Cookie-authenticated requests from any other origin are refused. */
  readonly webOrigin: Option.Option<string>;
  readonly port: number;
  /** Build identity reported by `/ai/health`. */
  readonly version: string;
}

export class AppConfig extends Context.Service<AppConfig, AppConfigShape>()("@plane/ai/AppConfig") {
  static readonly layer = Layer.effect(
    AppConfig,
    Effect.gen(function* () {
      const webUrl = yield* Config.option(Config.URL("WEB_URL"));
      return AppConfig.of({
        djangoUrl: (yield* Config.String("DJANGO_URL").pipe(Config.withDefault("http://api:8000"))).replace(/\/$/, ""),
        internalToken: yield* Config.Redacted("SUMMON_AI_INTERNAL_TOKEN"),
        planeMcpUrl: yield* Config.String("PLANE_MCP_URL").pipe(
          Config.withDefault("http://mcp:8211/mcp/http/api-key/mcp")
        ),
        webOrigin: Option.map(webUrl, (url) => url.origin),
        port: yield* Config.Port("PORT").pipe(Config.withDefault(3300)),
        version: yield* Config.String("APP_VERSION").pipe(Config.withDefault("dev")),
      });
    })
  );
}
