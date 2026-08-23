import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Summon Home has no render-time clock or random dependency", () => {
  const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /new Date\(\)\.getHours\(\)|Math\.random\(\)/);
});

test("SPA hydrate fallback does not inject unmatched document markup", () => {
  const root = readFileSync(new URL("../../../../root.tsx", import.meta.url), "utf8");
  const clientEntry = readFileSync(new URL("../../../../entry.client.tsx", import.meta.url), "utf8");
  assert.match(root, /function HydrateFallback\(\)\s*{\s*return null;/);
  assert.doesNotMatch(root, /function HydrateFallback[\s\S]*useEffect/);
  assert.match(clientEntry, /:scope > :not\(head\):not\(body\)/);
  assert.match(clientEntry, /new MutationObserver\(removeInjectedDocumentElements\)/);
  assert.match(clientEntry, /documentObserver\.disconnect\(\)/);
  assert.ok(clientEntry.indexOf(":scope > :not(head):not(body)") < clientEntry.indexOf("hydrateRoot("));
});
