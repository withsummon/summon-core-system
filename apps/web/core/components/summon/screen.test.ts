import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const screenSource = readFileSync(new URL("./screen.tsx", import.meta.url), "utf8");

test("Summon pages share one header owner and leave the sidebar toggle to the top bar", () => {
  assert.match(screenSource, /export function SummonPageHeader/);
  assert.match(screenSource, /<SummonPageHeader title=\{props.title\}/);
  assert.doesNotMatch(screenSource, /AppSidebarToggleButton/);
});

test("Summon renders typed project requirements and revoked-access errors", () => {
  assert.match(screenSource, /case "project_required"/);
  assert.match(screenSource, /case "project_access_revoked"/);
  assert.match(screenSource, /case "unsupported_document_type"/);
});
