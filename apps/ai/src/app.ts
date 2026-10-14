/**
 * The AI service as one Layer: routes plus the services they use. `main.ts` serves it with Bun;
 * tests serve it with `HttpRouter.toWebHandler` and a fake Django.
 */
import { Effect, Layer, Option } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { Auth } from "./auth";
import { ChatRoute } from "./chat";
import { AppConfig } from "./config";
import { Django } from "./django";
import { McpRoutes } from "./mcp";
import { Models } from "./model";
import { PlaneMcp } from "./plane-mcp";

const HealthRoute = HttpRouter.add(
  "GET",
  "/ai/health",
  Effect.gen(function* () {
    const config = yield* AppConfig;
    return HttpServerResponse.jsonUnsafe({ status: "ok", version: config.version });
  })
);

/**
 * Browsers only call the chat route from the web app. Behind Caddy that is the same origin; in local
 * development the web app runs on another port and sends the session cookie cross-origin.
 */
const Cors = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* AppConfig;
    return HttpRouter.cors({
      allowedOrigins: Option.toArray(config.webOrigin),
      allowedMethods: ["GET", "POST"],
      allowedHeaders: ["content-type"],
      credentials: true,
    });
  })
);

export const Routes = Layer.mergeAll(HealthRoute, ChatRoute, McpRoutes, Cors);

/** What the routes use. Needs an `HttpClient` (to Django and the Plane MCP server) and `AppConfig`. */
export const Services = Layer.mergeAll(Auth.layer, Models.layer, PlaneMcp.layer).pipe(Layer.provideMerge(Django.layer));
