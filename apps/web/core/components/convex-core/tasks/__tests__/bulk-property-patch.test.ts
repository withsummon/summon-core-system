import assert from "node:assert/strict";
import test from "node:test";
import { bulkPropertyPatch } from "../bulk-property-patch.ts";
import type { TaskPropertyValues } from "../task-properties";
const values: TaskPropertyValues = {
  status: "done",
  stateId: null,
  priority: "high",
  assigneeIds: [],
  labelIds: [],
  startDate: null,
  targetDate: "2026-10-01",
  estimatePointId: null,
};
test("only checked properties are submitted and state group clears custom state", () => {
  assert.deepEqual(bulkPropertyPatch(values, ["state", "startDate", "estimate"]), {
    status: "done",
    stateId: null,
    startDate: null,
    estimatePointId: null,
  });
  assert.deepEqual(bulkPropertyPatch(values, []), {});
  assert.deepEqual(bulkPropertyPatch(values, ["priority"]), { priority: "high" });
});
test("unchecked dates remain omitted while explicitly selected empty collections are additive no-ops", () => {
  const patch = bulkPropertyPatch(values, ["assignees", "labels"]);
  assert.deepEqual(patch, { assigneeIds: [], labelIds: [] });
  assert.equal("startDate" in patch, false);
  assert.equal("targetDate" in patch, false);
});
