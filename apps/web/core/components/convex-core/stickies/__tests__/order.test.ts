import assert from "node:assert/strict";
import test from "node:test";
import { adjacentStickyOrder } from "../order.ts";
test("reordering uses persisted descending neighbors and never assumes the loaded tail is the end", () => {
  const rows = [{ sortOrder: 30000 }, { sortOrder: 20000 }, { sortOrder: 10000 }];
  assert.equal(adjacentStickyOrder(rows, 2, "up", true), 25000);
  assert.equal(adjacentStickyOrder(rows, 0, "down", true), 15000);
  assert.equal(adjacentStickyOrder(rows, 1, "down", true), null);
  assert.equal(adjacentStickyOrder(rows, 1, "down", false), 0);
  assert.equal(adjacentStickyOrder(rows, 0, "up", false), null);
});
test("equal adjacent positions are not advertised as a successful interior move", () => {
  assert.equal(adjacentStickyOrder([{ sortOrder: 20 }, { sortOrder: 20 }, { sortOrder: 10 }], 2, "up", false), null);
});
