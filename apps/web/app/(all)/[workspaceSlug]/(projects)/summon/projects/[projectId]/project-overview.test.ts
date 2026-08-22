import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Project Overview uses its aggregate and keeps native Plane task and page links", () => {
  const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

  assert.match(source, /getProjectOverview/);
  assert.match(source, /\/issues\//);
  assert.match(source, /\/pages\//);
});
