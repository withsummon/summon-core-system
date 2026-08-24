import assert from "node:assert/strict";
import test from "node:test";

import { buildCodexArgs, buildPrompt, validateGenerateRequest } from "./server.mjs";

test("builds an isolated ephemeral Codex invocation", () => {
  assert.deepEqual(
    buildCodexArgs({
      model: "gpt-5.3-codex",
      outputPath: "/tmp/output",
      schemaPath: "/tmp/schema.json",
    }),
    [
      "exec",
      "--ephemeral",
      "--ignore-user-config",
      "--ignore-rules",
      "--skip-git-repo-check",
      "--sandbox",
      "read-only",
      "--cd",
      "/workspace",
      "--model",
      "gpt-5.3-codex",
      "--output-schema",
      "/tmp/schema.json",
      "--output-last-message",
      "/tmp/output",
      "-",
    ]
  );
});

test("preserves system and message roles in the prompt", () => {
  assert.equal(
    buildPrompt({
      system: "Be concise.",
      messages: [
        { role: "user", content: "Question" },
        { role: "assistant", content: "Earlier answer" },
      ],
    }),
    'System instructions:\nBe concise.\n\nConversation:\n[{"role":"user","content":"Question"},{"role":"assistant","content":"Earlier answer"}]'
  );
});

test("rejects malformed generate requests", () => {
  assert.throws(() => validateGenerateRequest({ model: "", messages: [] }), /model is required/);
  assert.throws(
    () =>
      validateGenerateRequest({
        model: "gpt-5.3-codex",
        system: "",
        messages: [{ role: "tool", content: "x" }],
        response_schema: null,
      }),
    /messages are invalid/
  );
});
