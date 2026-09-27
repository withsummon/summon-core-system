import assert from "node:assert/strict";
import test from "node:test";
import { notificationTarget } from "../comment-target.ts";
test("a comment notification opens its task with a canonical comment selector", () => {
  const params = notificationTarget("northstar", "DELIVERY", "task-1", "comment-older-than-page");
  assert.deepEqual(Object.fromEntries(params), {
    workspace: "northstar",
    project: "DELIVERY",
    task: "task-1",
    module: "projects",
    comment: "comment-older-than-page",
  });
});
test("ordinary task activity has no stale comment selector", () => {
  assert.equal(notificationTarget("northstar", "DELIVERY", "task-1").has("comment"), false);
});
