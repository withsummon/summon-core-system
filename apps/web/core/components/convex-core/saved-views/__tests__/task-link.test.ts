import assert from "node:assert/strict";
import test from "node:test";
import { savedViewTaskLink } from "../task-link.ts";
test("workspace view result opens its canonical project and clears stale lifecycle/view state", () => {
  const source = new URLSearchParams(
    "workspace=northstar&module=views&project=WRONG&projectView=views&savedView=old&savedViewTab=trash&taskView=deleted&cycle=old&intake=old&comment=old-comment"
  );
  const destination = new URLSearchParams(savedViewTaskLink(source, "RIGHT", "task-1"));
  assert.equal(destination.get("workspace"), "northstar");
  assert.equal(destination.get("module"), "projects");
  assert.equal(destination.get("project"), "RIGHT");
  assert.equal(destination.get("task"), "task-1");
  for (const key of ["savedView", "savedViewTab", "taskView", "cycle", "intake", "comment"])
    assert.equal(destination.has(key), false);
  assert.equal(destination.get("projectView"), "tasks");
  assert.equal(source.get("project"), "WRONG");
});
