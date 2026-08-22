import assert from "node:assert/strict";
import test from "node:test";
import { isSummonWorkspacePath } from "./route.ts";

test("identifies only workspace Summon routes", () => {
  for (const pathname of ["/core/summon", "/core/summon/", "/core/summon/resources"]) {
    assert.equal(isSummonWorkspacePath(pathname), true, pathname);
  }

  for (const pathname of ["/summon", "/core/projects", "/core/summoning"]) {
    assert.equal(isSummonWorkspacePath(pathname), false, pathname);
  }
});
