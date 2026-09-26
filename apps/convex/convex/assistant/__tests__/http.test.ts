import { afterEach, expect, test, vi } from "vitest";
import { workspaceJourney } from "../../../test-support/fixtures";
import { api } from "../../_generated/api";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
async function setup() {
  const base = await workspaceJourney();
  const conversationId = await base.owner.mutation(api.assistant.index.save, {
    workspaceId: base.workspaceId,
    title: "Assistant",
    context: { projectId: base.projectId, clientId: null, meetingId: null, documentIds: [] },
  });
  return { ...base, conversationId };
}
test("HTTP boundary requires authentication and reports unconfigured provider without creating messages", async () => {
  const { t, owner, conversationId } = await setup();
  vi.stubEnv("LLM_API_KEY", "");
  expect((await t.fetch("/assistant/reply", { method: "POST" })).status).toBe(401);
  expect(
    (
      await owner.fetch("/assistant/reply", {
        method: "POST",
        body: JSON.stringify({ conversationId, requestId: "request-0001", content: "Hello" }),
      })
    ).status
  ).toBe(503);
  expect(
    (
      await owner.query(api.assistant.index.messages, {
        conversationId,
        paginationOpts: { numItems: 20, cursor: null },
      })
    ).page
  ).toHaveLength(0);
});
test("authenticated HTTP stream persists real mocked provider chunks and completes its message", async () => {
  const { owner, conversationId } = await setup();
  vi.stubEnv("LLM_API_KEY", "mock-provider-key");
  vi.stubEnv("LLM_PROVIDER", "openai");
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          'data: {"choices":[{"delta":{"content":"Hello from provider"},"finish_reason":null}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'
        )
    )
  );
  const response = await owner.fetch("/assistant/reply", {
    method: "POST",
    body: JSON.stringify({ conversationId, requestId: "request-0001", content: "Hello" }),
  });
  expect(response.status).toBe(200);
  const body = await response.text();
  expect(body).toContain("event: done");
  expect(body).toContain("Hello from provider");
  const messages = await owner.query(api.assistant.index.messages, {
    conversationId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(messages.page.find((message) => message.role === "assistant")).toMatchObject({
    status: "completed",
    content: "Hello from provider",
  });
});
