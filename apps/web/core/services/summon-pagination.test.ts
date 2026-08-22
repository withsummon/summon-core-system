import assert from "node:assert/strict";
import test from "node:test";

const { listAllCursorResults } = (await import(
  new URL("./summon-pagination.ts", import.meta.url).href
)) as typeof import("./summon-pagination");

test("collects every cursor page for Task Center", async () => {
  const cursors: Array<string | undefined> = [];
  const issues = await listAllCursorResults(async (cursor) => {
    cursors.push(cursor);
    if (!cursor) {
      return {
        results: [{ id: "first" }],
        next_cursor: "20:0:0",
        next_page_results: true,
      };
    }
    return {
      results: [{ id: "second" }],
      next_cursor: "",
      next_page_results: false,
    };
  });

  assert.deepEqual(cursors, [undefined, "20:0:0"]);
  assert.deepEqual(issues, [{ id: "first" }, { id: "second" }]);
});
