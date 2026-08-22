import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const service = readFileSync(new URL("../../../../../../core/services/summon.service.ts", import.meta.url), "utf8");

test("Automation previews before an explicit idempotent publish", () => {
  assert.match(service, /generateAutomationPreview/);
  assert.match(service, /publishAutomationJob/);
  assert.match(source, /preview_markdown/);
  assert.match(source, /Publish to Plane Page/);
  assert.match(source, /window\.confirm/);
  assert.match(source, /page_detail/);
  assert.match(source, /Select Plane Project/);
  assert.match(source, /disabled=\{!template \|\| !outputProject/);
  assert.doesNotMatch(source, /Workspace Page/);
});

test("Automation exposes explicit context, citations, metadata, and retry state", () => {
  assert.match(source, /workspaceContext/);
  assert.match(source, /pageIds/);
  assert.match(source, /citations/);
  assert.match(source, /context_truncated/);
  assert.match(source, /provider/);
  assert.match(source, /model/);
  assert.match(source, /Retry preview/);
  assert.doesNotMatch(source, /apiKey|LLM_API_KEY|credential.*secret/i);
});
