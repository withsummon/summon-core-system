import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("management reporting follows the reference hierarchy with real report bindings", () => {
  const view = read("./reports/report-view.tsx");
  const visuals = read("./reports/report-visuals.tsx");
  const source = `${view}\n${visuals}`;

  for (const section of [
    "Overview",
    "Company Progress",
    "Project Health",
    "Pipeline Overview",
    "Investment Disbursement Progress",
    "Portfolio / Client Database",
    "Recent Reports",
  ]) {
    assert.match(source, new RegExp(section));
  }

  assert.match(source, /data\.projects/);
  assert.match(source, /data\.issues\.overdue/);
  assert.match(source, /data\.opportunity_stages/);
  assert.match(source, /No disbursement data source configured/);
  assert.doesNotMatch(source, /24\.8B|37\.6B|Pegadaian|SANFIND|Mutiara/);
});

test("client detail follows the reference hierarchy and persists edits through the API", () => {
  const page = read("./clients/[clientId]/page.tsx");

  for (const section of [
    "Overview",
    "Active Opportunities",
    "Recent Projects",
    "Key Contacts",
    "Recent Activity",
    "Relationship Health",
    "Client Information",
    "Notes",
  ]) {
    assert.match(page, new RegExp(section));
  }

  assert.match(page, /summonService\.getClientDetail/);
  assert.match(page, /summonService\.updateClient/);
  assert.match(page, /data\.page_contexts/);
  assert.match(page, /data\.recent_activity/);
  assert.doesNotMatch(page, /Pegadaian|Andika Pratama|Budi Santoso|Citra Lestari/);
});

test("Dokploy MCP keeps the PAT route independent from an OAuth secret bind", () => {
  const compose = readFileSync(
    new URL("../../../../../../../deployments/dokploy/compose.yml", import.meta.url),
    "utf8"
  );

  assert.match(compose, /PLANE_OAUTH_PROVIDER_CLIENT_SECRET:.*pat-route-only/);
  assert.doesNotMatch(compose, /plane_oauth_client_secret|\/run\/secrets\/plane_oauth/);
});
