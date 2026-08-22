import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Summon Home has no render-time clock or random dependency", () => {
  const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /new Date\(\)\.getHours\(\)|Math\.random\(\)/);
});
