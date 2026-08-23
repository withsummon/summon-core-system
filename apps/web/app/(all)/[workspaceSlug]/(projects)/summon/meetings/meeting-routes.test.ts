import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const optionalSource = (path: string) => {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
};
const detailSource = () =>
  source("./[meetingId]/page.tsx") +
  optionalSource("../../../../../../core/components/summon/meetings/meeting-detail-workspace.tsx") +
  optionalSource("../../../../../../core/components/summon/meetings/meeting-detail-rail.tsx") +
  optionalSource("../../../../../../core/components/summon/meetings/meeting-detail-meta.tsx");

test("meeting detail is direct-reloadable and reads persisted associations", () => {
  const detail = detailSource();
  assert.match(detail, /getMeeting/);
  assert.match(detail, /recording_asset_detail/);
  assert.match(detail, /transcript_text/);
  assert.match(detail, /work_items/);
  assert.match(source("../../../../../routes/extended.ts"), /summon\/meetings\/:meetingId/);
});

test("meeting summary is transcript-gated and suggestions require native confirmation", () => {
  const detail = detailSource();
  const service = source("../../../../../../core/services/summon.service.ts");
  assert.match(service, /summarizeMeeting/);
  assert.match(detail, /summary_error/);
  assert.match(detail, /decisions/);
  assert.match(detail, /action_suggestions/);
  assert.match(detail, /window\.confirm/);
  assert.match(detail, /Regenerate/);
  assert.match(detail, /canRegenerate/);
  assert.doesNotMatch(detail, /linkMeetingIssue/);
});

test("Meetings is available from the Summon sidebar with its own icon", () => {
  const constants = source("../../../../../../../../packages/constants/src/summon.ts");
  const icons = source("../../../../../../core/components/workspace/sidebar/helper.tsx");

  assert.match(constants, /key: "summon_meetings"/);
  assert.match(constants, /path: "meetings"/);
  assert.match(icons, /case "summon_meetings"/);
});

test("meeting detail follows the supplied workspace layout with real controls", () => {
  const detail = detailSource();

  for (const section of [
    "Recording",
    "Transcript",
    "AI Summary",
    "Action Items",
    "Related Documents",
    "Meeting Activity",
    "Meeting Details",
    "Participants",
  ])
    assert.match(detail, new RegExp(section));

  assert.match(detail, /copyUrlToClipboard/);
  assert.match(detail, /summarizeMeeting/);
  assert.match(detail, /settings\/members/);
  assert.match(detail, /data\.work_items/);
  assert.doesNotMatch(detail, /mock-data|const mock/i);
});
