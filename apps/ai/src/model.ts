/**
 * The chat model comes from Django's instance configuration (god-mode AI form), read through
 * `internal/ai-config/` and cached for 30 s, so a provider change applies without a deploy.
 * The AI service has no provider keys of its own.
 */
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { ChatErrorCode } from "@plane/summon-contract/chat";
import { Context, Duration, Effect, Exit, Layer, Schema } from "effect";
import { Django } from "./django";

const isChatErrorCode = Schema.is(ChatErrorCode);

export class ModelUnavailable extends Schema.TaggedError<ModelUnavailable>()("ModelUnavailable", {
  errorCode: ChatErrorCode,
  cause: Schema.optionalKey(Schema.Defect()),
}) {}

export interface ChatModel {
  readonly model: LanguageModel;
  readonly provider: string;
  readonly modelId: string;
}

const CONFIG_TTL = Duration.seconds(30);

export class Models extends Context.Service<Models, { readonly chat: Effect.Effect<ChatModel, ModelUnavailable> }>()(
  "@plane/ai/Models"
) {
  static readonly layer = Layer.effect(
    Models,
    Effect.gen(function* () {
      const django = yield* Django;
      const load = django.internal.internalAiConfig(undefined).pipe(
        Effect.flatMap((config) => {
          // Only OpenRouter streams through this service; Django's blocking path serves the other providers.
          if (config.provider !== "openrouter") {
            return Effect.fail(new ModelUnavailable({ errorCode: "llm_provider_unsupported" }));
          }
          const openrouter = createOpenRouter({
            apiKey: config.api_key,
            ...(config.base_url ? { baseURL: config.base_url } : {}),
          });
          return Effect.succeed<ChatModel>({
            // Reasoning effort is the largest latency lever measured (TTFT 1.95 s → 1.27 s at `low`).
            model: openrouter(config.model, { usage: { include: true }, reasoning: { effort: "low" } }),
            provider: config.provider,
            modelId: config.model,
          });
        }),
        // Django answers 503 with an `llm_*` code when the instance has no usable provider.
        Effect.catchTag("InternalAiConfig503", (error) =>
          Effect.fail(
            new ModelUnavailable({
              errorCode: isChatErrorCode(error.cause.error_code) ? error.cause.error_code : "summon_unavailable",
            })
          )
        ),
        Effect.catchTag(["HttpClientError", "SchemaError"], (error) =>
          Effect.fail(new ModelUnavailable({ errorCode: "summon_unavailable", cause: error }))
        )
      );
      const chat = yield* Effect.cachedWithTTL(load, (exit) => (Exit.isSuccess(exit) ? CONFIG_TTL : Duration.zero));
      return Models.of({ chat });
    })
  );
}
