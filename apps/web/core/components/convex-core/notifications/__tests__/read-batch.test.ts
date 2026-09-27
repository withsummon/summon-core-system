import assert from "node:assert/strict";
import test from "node:test";
import { readNotificationBatch } from "../read-batch.ts";
test("mark matching read continues through sparse pages until the server ends the batch", async () => {
  const pages = [
    { isDone: false, changed: 0 },
    { isDone: false, changed: 3 },
    { isDone: true, changed: 1 },
  ];
  const changes: number[] = [];
  await readNotificationBatch(
    async () => {
      const page = pages.shift();
      assert.ok(page);
      return page;
    },
    new AbortController().signal,
    (changed) => changes.push(changed)
  );
  assert.deepEqual(changes, [0, 3, 1]);
  assert.equal(pages.length, 0);
});
test("stopping during an in-flight page never schedules another mutation or updates progress", async () => {
  const controller = new AbortController();
  let calls = 0;
  const changes: number[] = [];
  await readNotificationBatch(
    async () => {
      calls++;
      controller.abort();
      return { isDone: false, changed: 2 };
    },
    controller.signal,
    (changed) => changes.push(changed)
  );
  assert.equal(calls, 1);
  assert.deepEqual(changes, []);
});
