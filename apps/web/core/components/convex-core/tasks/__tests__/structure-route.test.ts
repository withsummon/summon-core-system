import assert from "node:assert/strict";
import test from "node:test";
import { relatedTaskRoute } from "../structure-route.ts";
test("cross-project links use destination project while clearing stale task subviews", () => {
  const current = new URLSearchParams({
    workspace: "team",
    module: "tasks",
    project: "OLD",
    projectView: "cycles",
    taskView: "deleted",
    comment: "old",
  });
  const next = new URL(relatedTaskRoute(current, "target", "NEW"), "http://localhost").searchParams;
  assert.equal(next.get("workspace"), "team");
  assert.equal(next.get("project"), "NEW");
  assert.equal(next.get("module"), "projects");
  assert.equal(next.get("task"), "target");
  for (const field of ["projectView", "taskView", "comment"]) assert.equal(next.has(field), false);
  assert.equal(current.get("project"), "OLD");
});
