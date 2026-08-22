import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's type-stripping test runner requires the source extension.
import { normalizeLinkPrefetch } from "./helper.ts";

test("maps Next-style prefetch values to React Router prefetch behavior", () => {
  assert.equal(normalizeLinkPrefetch(true), "intent");
  assert.equal(normalizeLinkPrefetch(false), "none");
  assert.equal(normalizeLinkPrefetch("render"), "render");
  assert.equal(normalizeLinkPrefetch(undefined), undefined);
});
