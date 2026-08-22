import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("meeting detail is direct-reloadable and reads persisted associations", () => {
  const detail = source("./[meetingId]/page.tsx");
  assert.match(detail, /getMeeting/);
  assert.match(detail, /recording_asset_detail/);
  assert.match(detail, /transcript_text/);
  assert.match(detail, /work_items/);
  assert.match(source("../../../../../routes/extended.ts"), /summon\/meetings\/:meetingId/);
});

test("meeting summary is transcript-gated and suggestions require native confirmation", () => {
  const detail = source("./[meetingId]/page.tsx");
  const service = source("../../../../../../core/services/summon.service.ts");
  assert.match(service, /summarizeMeeting/);
  assert.match(detail, /summary_error/);
  assert.match(detail, /decisions/);
  assert.match(detail, /action_suggestions/);
  assert.match(detail, /window\.confirm/);
  assert.match(detail, /Generate summary/);
  assert.match(detail, /disabled=\{!data\.project/);
  assert.match(detail, /Link an authorized Plane Project/);
  assert.doesNotMatch(detail, /linkMeetingIssue/);
});
