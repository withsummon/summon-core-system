import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Effect, Layer, Logger } from "effect";
import { FetchHttpClient, HttpRouter } from "effect/http";
import { Routes, Services } from "./app";
import { AppConfig } from "./config";

const ServerLayer = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* AppConfig;
    // Bun's idle timeout caps silent gaps in a stream; the UI stream also sends a keep-alive every 15 s.
    return BunHttpServer.layer({ port: config.port, idleTimeout: 120 });
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
