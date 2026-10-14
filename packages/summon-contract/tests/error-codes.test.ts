import type { TInstanceLLMErrorCode } from "@plane/types";
import { describe, expectTypeOf, it } from "vitest";
import type { ChatErrorCode, ChatRefusalCode, LLMErrorCode } from "../src/chat";

// Type-level: `tsc` (check:types) fails when a list drifts; the runtime assertions are trivially true.
describe("LLM error codes", () => {
  it("match @plane/types, which the web app's copy tables are keyed by", () => {
    expectTypeOf<LLMErrorCode>().toEqualTypeOf<TInstanceLLMErrorCode>();
  });

  it("are all chat stream and refusal codes", () => {
    expectTypeOf<LLMErrorCode>().toExtend<ChatErrorCode>();
    expectTypeOf<ChatErrorCode>().toExtend<ChatRefusalCode>();
  });
});
