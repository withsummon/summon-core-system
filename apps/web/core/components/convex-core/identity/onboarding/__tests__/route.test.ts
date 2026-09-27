import assert from "node:assert/strict";
import test from "node:test";
import { completionRoute } from "../route.ts";
test("same chosen workspace preserves requested detail and uses renamed canonical slug", () => {
  const original = new URLSearchParams("workspace=old&module=documents&document=doc&project=PROJ");
  const next = completionRoute(original, "old", "renamed");
  assert.equal(next.get("workspace"), "renamed");
  assert.equal(next.get("document"), "doc");
  assert.equal(original.get("workspace"), "old");
});
test("explicit different workspace and missing workspace start selected workspace default", () => {
  for (const query of ["workspace=other&project=OLD&task=task&document=doc", "project=OLD&task=task"]) {
    assert.equal(completionRoute(new URLSearchParams(query), "selected", "current").toString(), "workspace=current");
  }
});
