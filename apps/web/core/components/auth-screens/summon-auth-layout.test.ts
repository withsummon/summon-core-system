import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Summon auth composition keeps Plane authentication and names the product overview", () => {
  const authRoot = readFileSync(new URL("../account/auth-forms/auth-root.tsx", import.meta.url), "utf8");
  const authBase = readFileSync(new URL("./auth-base.tsx", import.meta.url), "utf8");

  assert.match(authRoot, /AuthRoot/);
  assert.doesNotMatch(authRoot, /fetch\(|axios\.|summonService/);
  assert.match(authBase, /aria-label="Summon Core product overview"/);
});
