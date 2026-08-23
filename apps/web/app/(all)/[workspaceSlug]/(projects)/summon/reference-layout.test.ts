import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Home uses the reference two-panel project workspace with real Summon data", () => {
  const home = source("../../../../../core/components/summon/home/home-root.tsx");

  assert.match(home, /xl:grid-cols-\[minmax\(20rem,0\.72fr\)_minmax\(34rem,1\.28fr\)\]/);
  assert.match(home, /getHomeSummary/);
  assert.match(home, /getProjectOverview/);
  assert.match(home, /Project Progress/);
  assert.match(home, /Latest Documents/);
  assert.doesNotMatch(home, /mock-data/);
});

test("Project overview exposes the reference workspace hierarchy", () => {
  const project = source("./projects/[projectId]/page.tsx");

  for (const section of [
    "Project Timeline",
    "Tasks Overview",
    "Latest Activity",
    "Quick Access",
    "Team Members",
    "Project Health",
  ])
    assert.match(project, new RegExp(section));
  assert.match(project, /fetchProjectMembers/);
  assert.doesNotMatch(project, /mock-data/);
});

test("Knowledge dashboard is backed by accessible Plane Pages and explicit unavailable analytics", () => {
  const knowledge = source("./knowledge/page.tsx");

  assert.match(knowledge, /listAccessiblePlanePages/);
  assert.match(knowledge, /listPageContexts/);
  assert.match(knowledge, /Browse by Context/);
  assert.match(knowledge, /View analytics are not available from Plane Pages/);
  assert.doesNotMatch(knowledge, /mock-data/);
});
