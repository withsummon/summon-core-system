import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Project Overview uses its aggregate and keeps native Plane task and page links", () => {
  const workspace = readFileSync(new URL("./project-detail-workspace.tsx", import.meta.url), "utf8");
  const source = ["page.tsx", "project-detail-tabs.tsx"]
    .map((file) => readFileSync(new URL(`./${file}`, import.meta.url), "utf8"))
    .concat(workspace)
    .join("\n");

  assert.match(source, /getProjectOverview/);
  assert.match(source, /\/issues\//);
  assert.match(source, /\/pages\//);
  assert.match(source, /role="tab"/);
  assert.match(workspace, /onClick=\{\(\) => setActiveTab\(tab\.id\)\}/);
  assert.doesNotMatch(workspace, /router\.(push|replace)/);
  assert.match(source, /toggleCreateIssueModal\(true, EIssuesStoreType\.PROJECT, \[projectId\]\)/);
  assert.match(source, /toggleCreateModuleModal\(true\)/);
  assert.match(source, /toggleCreatePageModal\(\{ isOpen: true \}\)/);
  assert.doesNotMatch(source, /Project workspace/);
});
