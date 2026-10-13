import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Home uses the reference two-panel project workspace with real Summon data", () => {
  const home = source("../../../../../core/components/summon/home/home-root.tsx");
  const preview = source("../../../../../core/components/summon/home/home-project-preview.tsx");

  assert.match(home, /xl:grid-cols-\[minmax\(20rem,0\.72fr\)_minmax\(34rem,1\.28fr\)\]/);
  assert.match(home, /getHomeSummary/);
  assert.match(home, /getProjectOverview/);
  assert.match(preview, /title="Progress"/);
  assert.match(preview, /title="Latest documents"/);
  assert.doesNotMatch(`${home}\n${preview}`, /mock-data/);
});

test("Project overview exposes the reference workspace hierarchy", () => {
  const page = source("./projects/[projectId]/page.tsx");
  const workspace = source("./projects/[projectId]/project-detail-workspace.tsx");
  const tabs = source("./projects/[projectId]/project-detail-tabs.tsx");

  for (const section of [
    "Overview",
    "Tasks",
    "Milestones",
    "Documents",
    "Repositories",
    "Deployments",
    "Activity",
    "Files",
  ])
    assert.match(tabs, new RegExp(`label: "${section}"`));
  assert.match(page, /summonService\.getProjectOverview/);
  assert.match(workspace, /useHashTab\(PROJECT_TABS\.map/);
  assert.match(workspace, /getUserDetails/);
  assert.doesNotMatch(`${page}\n${workspace}\n${tabs}`, /mock-data/);
});

test("Knowledge dashboard is backed by accessible Plane Pages and shows no sourceless analytics", () => {
  const knowledge = `${source("./knowledge/page.tsx")}\n${source("./knowledge/knowledge-model.ts")}`;

  assert.match(knowledge, /listAccessiblePlanePages/);
  assert.match(knowledge, /listPageContexts/);
  assert.match(knowledge, /SummonMetricStrip/);
  assert.doesNotMatch(knowledge, /Total Views|Popular Knowledge|Browse by Context/);
  assert.doesNotMatch(knowledge, /updated_at\?\.getTime/);
  assert.match(knowledge, /Date\.parse\(String\(.*updated_at/);
  assert.doesNotMatch(knowledge, /mock-data/);
  // Opportunities are commercial records: fetched and offered only with commercial.view.
  assert.match(knowledge, /can\("commercial\.view"\)/);
});
