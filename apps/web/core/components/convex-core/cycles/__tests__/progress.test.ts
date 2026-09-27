import test from "node:test";
import assert from "node:assert/strict";
import { summarizeCycleProgress, type CycleProgress } from "../progress-summary.ts";
const empty: CycleProgress = {
  count: 0,
  numericEstimates: 0,
  unquantifiedEstimates: 0,
  statuses: [],
  assignees: [],
  labels: [],
};
test("loaded contributions merge duplicate buckets without mutating reactive source pages", () => {
  const first: CycleProgress = {
    ...empty,
    count: 2,
    numericEstimates: 3.5,
    statuses: [{ id: "done", name: "done", count: 2, numericEstimates: 3.5, unquantifiedEstimates: 0 }],
  };
  const second: CycleProgress = {
    ...empty,
    count: 1,
    unquantifiedEstimates: 1,
    statuses: [{ id: "done", name: "done", count: 1, numericEstimates: 0, unquantifiedEstimates: 1 }],
  };
  const before = JSON.stringify([first, second]);
  const result = summarizeCycleProgress([first, empty, second]);
  assert.equal(result.count, 3);
  assert.deepEqual(result.statuses, [
    { id: "done", name: "done", count: 3, numericEstimates: 3.5, unquantifiedEstimates: 1 },
  ]);
  assert.equal(JSON.stringify([first, second]), before);
});
test("empty pages remain empty and a reactive replacement is recomputed rather than accumulated", () => {
  assert.deepEqual(summarizeCycleProgress([empty]), empty);
  assert.equal(summarizeCycleProgress([{ ...empty, count: 3 }]).count, 3);
  assert.equal(summarizeCycleProgress([{ ...empty, count: 1 }]).count, 1);
});
