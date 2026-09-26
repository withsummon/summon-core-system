import assert from "node:assert/strict";
import { test } from "node:test";
import { readReportPages, sumAmounts } from "../pages.ts";
test("a permission-filtered empty page continues before a complete result is published", async () => {
  const seen: Array<string | null> = [];
  let progress = 0;
  const contributions = await readReportPages(
    async (cursor) => {
      seen.push(cursor);
      return cursor === null
        ? { contribution: 0, coverage: "page", isDone: false, continueCursor: "next" }
        : { contribution: 12, coverage: "page", isDone: true, continueCursor: "" };
    },
    new AbortController().signal,
    () => progress++
  );
  assert.deepEqual(seen, [null, "next"]);
  assert.deepEqual(contributions, [0, 12]);
  assert.equal(progress, 2);
});
test("scope cancellation rejects in-flight results instead of publishing partial totals", async () => {
  const controller = new AbortController();
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const result = readReportPages(
    async () => {
      await pending;
      return { contribution: 99, coverage: "page", isDone: true, continueCursor: "" };
    },
    controller.signal,
    () => assert.fail("stale progress")
  );
  controller.abort();
  finish();
  await assert.rejects(result, { name: "AbortError" });
});
test("a later page failure cannot return earlier counts", async () => {
  await assert.rejects(
    readReportPages(
      async (cursor) => {
        if (cursor) throw new Error("Access revoked");
        return { contribution: 4, coverage: "page", isDone: false, continueCursor: "next" };
      },
      new AbortController().signal,
      () => {}
    ),
    /Access revoked/
  );
});
test("commercial page amounts preserve decimal accuracy and signed sub-unit values", () => {
  assert.equal(sumAmounts(["9999999999999999.99", "0.02"]), "10000000000000000.01");
  assert.equal(sumAmounts(["-0.02", "0.01"]), "-0.01");
});
