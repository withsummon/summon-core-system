import { afterEach, expect, test, vi } from "vitest";
import { parseDelta, providerConfig, streamProvider } from "../provider";
afterEach(() => vi.unstubAllGlobals());
test("missing credentials and unsupported providers fail without a fabricated reply", () => {
  expect(() => providerConfig({})).toThrow("not configured");
  expect(() => providerConfig({ LLM_API_KEY: "test-key", LLM_PROVIDER: "anthropic" })).toThrow("Unsupported");
});
test("provider contract rejects tool calls and truncated completions", () => {
  expect(() => parseDelta(JSON.stringify({ choices: [{ delta: { tool_calls: [{}] } }] }))).toThrow("not enabled");
  expect(() => parseDelta(JSON.stringify({ choices: [{ delta: {}, finish_reason: "length" }] }))).toThrow(
    "did not complete"
  );
});
test("actual fetch boundary decodes split SSE bytes and requires stop plus DONE", async () => {
  const encoder = new TextEncoder();
  const payload =
    'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\r\n\r\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';
  const fetchMock = vi.fn(
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            for (let i = 0; i < payload.length; i += 7) controller.enqueue(encoder.encode(payload.slice(i, i + 7)));
            controller.close();
          },
        })
      )
  );
  vi.stubGlobal("fetch", fetchMock);
  const config = providerConfig({
    LLM_API_KEY: "test-key",
    LLM_PROVIDER: "openai_compatible",
    LLM_BASE_URL: "https://provider.example/v1",
    LLM_MODEL: "configured-model",
  });
  let reply = "";
  for await (const delta of streamProvider(config, [{ role: "user", content: "Hello" }], new AbortController().signal))
    reply += delta;
  expect(reply).toBe("Hello");
  expect(fetchMock.mock.calls).toHaveLength(1);
});
test("HTTP failure and interrupted stream never count as completed", async () => {
  const config = providerConfig({ LLM_API_KEY: "test-key" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("upstream secret error", { status: 500 }))
  );
  const consume = async () => {
    for await (const delta of streamProvider(config, [], new AbortController().signal)) void delta;
  };
  await expect(consume()).rejects.toThrow("request failed");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response('data: {"choices":[{"delta":{"content":"Partial"}}]}\n\n'))
  );
  await expect(consume()).rejects.toThrow("before completion");
});
