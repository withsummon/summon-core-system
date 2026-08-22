import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const screenSource = readFileSync(new URL("./screen.tsx", import.meta.url), "utf8");

test("shared Summon UI exposes progress primitives without a chart package", () => {
  const source = readFileSync(new URL("./progress.tsx", import.meta.url), "utf8");
  assert.match(source, /export function SummonProgressRing/);
  assert.match(source, /conic-gradient/);
  assert.doesNotMatch(source, /recharts|chart\.js|echarts/);
});

test("Summon keeps the canonical sidebar recovery control in its collapsed header", () => {
  assert.match(screenSource, /AppSidebarToggleButton/);
  assert.match(screenSource, /useAppTheme/);
  assert.match(screenSource, /const \{ sidebarCollapsed \} = useAppTheme\(\)/);
  assert.match(screenSource, /sidebarCollapsed && <AppSidebarToggleButton \/>/);
});

test("Summon renders typed project requirements and revoked-access errors", () => {
  assert.match(screenSource, /case "project_required"/);
  assert.match(screenSource, /case "project_access_revoked"/);
  assert.match(screenSource, /case "unsupported_document_type"/);
});
