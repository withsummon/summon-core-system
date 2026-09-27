import assert from "node:assert/strict";
import test from "node:test";
import { stickiesRouteOwner } from "../ownership.ts";
test("inherited route stays legacy unless deployment explicitly assigns Convex", () => {
  assert.equal(stickiesRouteOwner(undefined), "legacy");
  assert.equal(stickiesRouteOwner("legacy"), "legacy");
  assert.equal(stickiesRouteOwner("convex"), "convex");
});
test("invalid route owner fails build instead of silently falling back", () => {
  for (const value of ["", "true", "Convex", "fallback"]) assert.throws(() => stickiesRouteOwner(value));
});
