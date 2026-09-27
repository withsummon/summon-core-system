import assert from "node:assert/strict";
import test from "node:test";
import { selectOrderedProject } from "../order-selection.ts";
test("explicit project selection preserves workspace and clears stale entity deep links without mutating the source", () => {
  const current = new URLSearchParams(
    "workspace=delivery&module=projects&project=OLD&task=id&comment=id&cycle=id&cycleView=archive&projectModule=id&moduleView=trash&intake=id&intakeStatus=pending&savedView=id&savedViewTab=trash&projectView=cycles&taskView=archive"
  );
  const next = selectOrderedProject(current, "NEW");
  assert.equal(next.toString(), "workspace=delivery&module=projects&project=NEW");
  assert.equal(current.get("project"), "OLD");
  assert.equal(current.get("task"), "id");
});
