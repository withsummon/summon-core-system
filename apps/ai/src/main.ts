import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Effect, Layer, Logger } from "effect";
import { FetchHttpClient, HttpRouter } from "effect/http";
import { Routes, Services } from "./app";
import { AppConfig } from "./config";

const ServerLayer = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* AppConfig;
    // Bun's idle timeout caps silent gaps in a stream; the UI stream also sends a keep-alive every 15 s.
    // On SIGTERM the server stops accepting and gives in-flight turns and MCP calls up to 5 minutes to finish, so a
    // start-first deploy (the new task already serves) does not cut a reply mid-stream. Swarm's stop grace period
    // must be longer.
    return BunHttpServer.layer({ port: config.port, idleTimeout: 120, gracefulShutdownTimeout: "5 minutes" });
  })
);

const Main = HttpRouter.serve(Routes).pipe(
  Layer.provide(Services),
  Layer.provide(ServerLayer),
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(AppConfig.layer),
  Layer.provide(Logger.layer([Logger.consoleJson]))
);

BunRuntime.runMain(Layer.launch(Main));
