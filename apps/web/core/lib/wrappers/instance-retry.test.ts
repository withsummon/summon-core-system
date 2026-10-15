import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's type-stripping test runner requires the source extension.
import { getInstanceRetryDelay } from "./instance-retry.ts";

test("retries the instance request after 1 s, then backs off", () => {
  assert.deepEqual([1, 2, 3, 4].map(getInstanceRetryDelay), [1000, 2000, 4000, 8000]);
});

test("caps the retry delay at 10 s and keeps retrying", () => {
  assert.equal(getInstanceRetryDelay(5), 10_000);
  assert.equal(getInstanceRetryDelay(50), 10_000);
});
