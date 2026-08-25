import assert from "node:assert/strict";
import test from "node:test";
import { shouldSubmitAssistantComposer } from "./composer-keyboard.js";

test("Assistant composer submits Enter but preserves Shift+Enter and IME composition", () => {
  assert.equal(shouldSubmitAssistantComposer({ key: "Enter", shiftKey: false, isComposing: false }), true);
  assert.equal(shouldSubmitAssistantComposer({ key: "Enter", shiftKey: true, isComposing: false }), false);
  assert.equal(shouldSubmitAssistantComposer({ key: "Enter", shiftKey: false, isComposing: true }), false);
  assert.equal(shouldSubmitAssistantComposer({ key: "Escape", shiftKey: false, isComposing: false }), false);
});
