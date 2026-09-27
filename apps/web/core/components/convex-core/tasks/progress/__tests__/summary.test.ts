import test from "node:test";
import assert from "node:assert/strict";
import { summarizeTaskProgress, type TaskProgress } from "../summary.ts";
const zero = { count: 0, numericEstimates: 0, unquantifiedEstimates: 0 };
const blank = { ...zero, completed: { ...zero }, pending: { ...zero } };
const empty: TaskProgress = {
  ...zero,
  completed: { ...zero },
  pending: { ...zero },
  statuses: [],
  labels: [],
  assignees: [],
};
test("loaded contributions merge completion buckets without mutating reactive source pages", () => {
  const first: TaskProgress = {
    ...empty,
    count: 2,
    numericEstimates: 3.5,
    completed: { count: 2, numericEstimates: 3.5, unquantifiedEstimates: 0 },
    statuses: [
      {
        ...blank,
        id: "done",
        name: "done",
        count: 2,
        numericEstimates: 3.5,
        completed: { count: 2, numericEstimates: 3.5, unquantifiedEstimates: 0 },
      },
    ],
  };
  const second: TaskProgress = {
    ...empty,
    count: 1,
    unquantifiedEstimates: 1,
    pending: { count: 1, numericEstimates: 0, unquantifiedEstimates: 1 },
    statuses: [
      {
        ...blank,
        id: "done",
        name: "done",
        count: 1,
        unquantifiedEstimates: 1,
        pending: { count: 1, numericEstimates: 0, unquantifiedEstimates: 1 },
      },
    ],
  };
  const before = JSON.stringify([first, second]);
  const result = summarizeTaskProgress([first, empty, second]);
  assert.equal(result.count, 3);
  assert.equal(result.statuses.length, 1);
  assert.deepEqual(result.completed, { count: 2, numericEstimates: 3.5, unquantifiedEstimates: 0 });
  assert.deepEqual(result.pending, { count: 1, numericEstimates: 0, unquantifiedEstimates: 1 });
  assert.equal(result.statuses[0].completed.count, 2);
  assert.equal(result.statuses[0].pending.count, 1);
  assert.equal(JSON.stringify([first, second]), before);
});
test("empty pages remain empty and live replacement recalculates instead of accumulating", () => {
  assert.deepEqual(summarizeTaskProgress([empty]), empty);
  assert.equal(summarizeTaskProgress([{ ...empty, count: 3 }]).count, 3);
  assert.equal(summarizeTaskProgress([{ ...empty, count: 1 }]).count, 1);
});
