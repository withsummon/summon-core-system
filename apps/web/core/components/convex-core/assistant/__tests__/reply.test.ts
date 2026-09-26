import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { RequestListener } from "node:http";
import { test } from "node:test";
import { requestAssistantReply } from "../reply.ts";

async function withServer(handler: RequestListener, exercise: (siteUrl: string) => Promise<void>) {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    await exercise(`http://127.0.0.1:${address.port}`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      })
    );
  }
}
const message = {
  token: "test-session-token",
  conversationId: "test-conversation",
  content: "Summarize selected context",
};

test("unconfigured provider leaves the draft unaccepted and returns the endpoint error", async () => {
  await withServer(
    (_request, response) => {
      response.writeHead(503);
      response.end("Assistant provider is not configured.");
    },
    async (siteUrl) => {
      let accepted = false;
      await assert.rejects(
        requestAssistantReply({
          ...message,
          siteUrl,
          signal: new AbortController().signal,
          onAccepted: () => {
            accepted = true;
          },
        }),
        /Assistant provider is not configured/
      );
      assert.equal(accepted, false);
    }
  );
});

test("authenticated reply sends one unique request and consumes transport without fabricating local messages", async () => {
  let received: unknown;
  await withServer(
    (request, response) => {
      assert.equal(request.url, "/assistant/reply");
      assert.equal(request.headers.authorization, "Bearer test-session-token");
      let data = "";
      request.on("data", (chunk) => {
        data += chunk;
      });
      request.on("end", () => {
        received = JSON.parse(data);
        response.writeHead(200, { "Content-Type": "text/event-stream" });
        response.write('event: delta\ndata: {"content":"transport only"}\n\n');
        response.end("event: done\ndata: {}\n\n");
      });
    },
    async (siteUrl) => {
      let accepted = 0;
      const result = await requestAssistantReply({
        ...message,
        siteUrl,
        signal: new AbortController().signal,
        onAccepted: () => {
          accepted++;
        },
      });
      assert.equal(result, undefined);
      assert.equal(accepted, 1);
      assert.ok(
        received && typeof received === "object" && "requestId" in received && typeof received.requestId === "string"
      );
      assert.match(received.requestId, /^[0-9a-f-]{36}$/);
      assert.deepEqual(new Set(Object.keys(received)), new Set(["content", "conversationId", "requestId"]));
    }
  );
});

test("leaving the conversation aborts its live transport", async () => {
  await withServer(
    (_request, response) => {
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      response.flushHeaders();
    },
    async (siteUrl) => {
      const controller = new AbortController();
      await assert.rejects(
        requestAssistantReply({ ...message, siteUrl, signal: controller.signal, onAccepted: () => controller.abort() }),
        { name: "AbortError" }
      );
    }
  );
});
