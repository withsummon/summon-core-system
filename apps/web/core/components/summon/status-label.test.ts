import assert from "node:assert/strict";
import test from "node:test";
const { statusLabel } = (await import(
  new URL("./status-label.ts", import.meta.url).href
)) as typeof import("./status-label");

test("every status value gets one English label, the same on every screen", () => {
  assert.equal(statusLabel("not_assessed"), "Not assessed");
  assert.equal(statusLabel("on_track"), "On track");
  assert.equal(statusLabel("in-progress"), "In progress");
});
