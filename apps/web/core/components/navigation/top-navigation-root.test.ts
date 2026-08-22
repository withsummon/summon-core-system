import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./top-navigation-root.tsx", import.meta.url), "utf8");
const summonShell = readFileSync(new URL("../summon/page-shell.tsx", import.meta.url), "utf8");

test("keeps Summon in the shared Plane chrome with theme switching and no GitHub promotion", () => {
  assert.match(source, /SummonThemeToggle/);
  assert.doesNotMatch(source, /StarUsOnGitHubLink/);
  assert.doesNotMatch(summonShell, /NAV_ITEMS|<aside/);
});
