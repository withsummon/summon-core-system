import assert from "node:assert/strict";
import test from "node:test";

import { buildCodexArgs, buildPrompt, validateGenerateRequest } from "./server.mjs";

test("uses the authenticated Codex account default model", () => {
  assert.deepEqual(
    buildCodexArgs({
      model: "default",
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
      "--output-schema",
      "/tmp/schema.json",
      "--output-last-message",
      "/tmp/output",
      "-",
    ]
  );
});

test("passes an explicitly selected model to Codex", () => {
  const args = buildCodexArgs({
    model: "gpt-5.6-sol",
    outputPath: "/tmp/output",
    schemaPath: null,
  });

  assert.deepEqual(args.slice(args.indexOf("--model"), args.indexOf("--model") + 2), ["--model", "gpt-5.6-sol"]);
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
