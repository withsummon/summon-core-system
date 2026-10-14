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
  optionalSource("../../../../../../core/components/summon/meetings/meeting-notes.tsx") +
  optionalSource("../../../../../../core/components/summon/meetings/meeting-transcript.tsx");

test("meeting detail is direct-reloadable and reads persisted associations", () => {
  const detail = detailSource();
  assert.match(detail, /getMeeting/);
  assert.match(detail, /recording_asset_detail/);
  assert.match(detail, /transcript_text/);
  assert.match(source("../../../../../routes/extended.ts"), /summon\/meetings\/:meetingId/);
});

test("meeting summary is transcript-gated", () => {
  const detail = detailSource();
  assert.match(detail, /summary_error/);
  assert.match(detail, /decisions/);
  assert.match(detail, /action_suggestions/);
  assert.match(detail, /Generate minutes/);
  assert.match(detail, /canGenerate/);
  assert.match(detail, /uploadWorkspaceAsset/);
  assert.match(detail, /MEETING_RECORDING/);
  assert.doesNotMatch(detail, /linkMeetingIssue/);
});

test("Meetings is available from the Summon sidebar with its own icon", () => {
  const constants = source("../../../../../../../../packages/constants/src/summon.ts");
  const icons = source("../../../../../../core/components/workspace/sidebar/helper.tsx");

  assert.match(constants, /key: "summon_meetings"/);
  assert.match(constants, /path: "meetings"/);
  assert.match(icons, /summon_meetings: CalendarDotsIcon/);
});

test("meeting detail pairs notes with a seekable, speaker-labelled transcript", () => {
  const detail = detailSource();

  assert.match(detail, /transcript_segments/);
  assert.match(detail, /external_url/);
  assert.match(detail, /currentTime = seconds/);
  assert.match(detail, /copyUrlToClipboard/);
  assert.match(detail, /summarizeMeeting/);
  assert.match(detail, /data\.work_items/);
  assert.doesNotMatch(detail, /settings\/members/);
  assert.doesNotMatch(detail, /mock-data|const mock/i);
});
