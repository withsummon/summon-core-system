import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const modelSource = readFileSync(new URL("./report-view-model.ts", import.meta.url), "utf8");
const modelUrl = `data:text/javascript;base64,${Buffer.from(
  ts.transpileModule(modelSource, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
  }).outputText
).toString("base64")}`;
// SAFETY: The loaded module is a direct TypeScript transpilation of report-view-model.ts above.
const model = (await import(modelUrl)) as typeof import("./report-view-model");
const { percentage, readReportFilters, reportLabel, reportRequestKey, trendPolylinePoints, updateReportFilter } = model;

test("report percentages handle empty and populated totals", () => {
  assert.equal(percentage(0, 0), 0);
  assert.equal(percentage(3, 4), 75);
});

test("report status labels expose meaning beyond color", () => {
  assert.equal(reportLabel("on_track"), "On track");
  assert.equal(reportLabel("not_assessed"), "Belum dinilai");
  assert.equal(reportLabel("in-progress"), "In progress");
});

test("report filters round-trip through the URL and request key", () => {
  const current = new URLSearchParams("client_id=client-1&date_from=2026-08-01");
  const updated = updateReportFilter(current, "project_id", "project/a");
  const filters = readReportFilters(updated);

  assert.equal(updated.toString(), "client_id=client-1&date_from=2026-08-01&project_id=project%2Fa");
  assert.deepEqual(filters, {
    projectId: "project/a",
    clientId: "client-1",
    dateFrom: "2026-08-01",
    dateTo: undefined,
  });
  assert.deepEqual(reportRequestKey("summon", filters), [
    "summon-report",
    "summon",
    "project/a",
    "client-1",
    "2026-08-01",
    "",
  ]);
  assert.equal(updateReportFilter(updated, "project_id", "").toString(), "client_id=client-1&date_from=2026-08-01");
});

test("trend points stay finite for empty and zero-only series", () => {
  assert.equal(trendPolylinePoints([]), "");
  assert.equal(trendPolylinePoints([0]), "0,80");
  assert.equal(trendPolylinePoints([0, 0]), "0,80 320,80");
});

test("report and CSV use the same filters without client-side money conversion or chart packages", () => {
  const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
  const view = readFileSync(new URL("./report-view.tsx", import.meta.url), "utf8");
  const visuals = readFileSync(new URL("./report-visuals.tsx", import.meta.url), "utf8");
  const implementation = `${page}\n${view}\n${visuals}`;

  assert.match(page, /getReport\(workspaceSlug, filters\)/);
  assert.match(page, /getReportExportUrl\(workspaceSlug, filters\)/);
  assert.match(view, /data\.commercial\.pipeline_value/);
  assert.match(view, /stage\.value/);
  assert.match(visuals, /type="date"/);
  assert.match(visuals, /<svg/);
  assert.doesNotMatch(implementation, /parseFloat|parseInt|Number\(|recharts|chart\.js|echarts/i);
});
