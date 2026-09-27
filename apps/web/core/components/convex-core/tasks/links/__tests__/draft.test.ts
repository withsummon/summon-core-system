import assert from "node:assert/strict";
import test from "node:test";
import { linkEditDraft } from "../draft.ts";
test("an open link edit retains its approved revision and excludes opaque metadata from replacement", () => {
  // Runtime fixture exercises the boundary without fabricating branded application IDs.
  const row = JSON.parse(
    '{"_id":"link-1","taskId":"task-1","updatedAt":10,"title":"Original","url":"https://example.com/","metadata":{"provider":"retained"}}'
  );
  const draft = linkEditDraft(row);
  row.updatedAt = 11;
  row.title = "Another editor";
  assert.equal(draft.expectedUpdatedAt, 10);
  assert.equal(draft.title, "Original");
  assert.equal(Object.hasOwn(draft, "metadata"), false);
  assert.equal(draft.taskId, "task-1");
});
