import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("does not pass computed MobX selectors directly to array callbacks", () => {
  const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /\.map\(getProjectById\)/);
});
