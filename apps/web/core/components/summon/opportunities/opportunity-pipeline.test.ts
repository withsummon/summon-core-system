import assert from "node:assert/strict";
import test from "node:test";
const { groupByStage, opportunitiesHref, parseStageFilter, resolveOpportunitySelection, stageCounts } = (await import(
  new URL("./opportunity-pipeline.ts", import.meta.url).href
)) as typeof import("./opportunity-pipeline");

const won = { id: "won", stage: "won" as const, updated_at: "2026-09-26T10:00:00Z" };
const proposal = { id: "proposal", stage: "proposal" as const, updated_at: "2026-09-26T09:00:00Z" };
const olderProposal = { id: "older", stage: "proposal" as const, updated_at: "2026-09-20T09:00:00Z" };

test("the inspector never shows a row the current filter hides", () => {
  assert.deepEqual(resolveOpportunitySelection([proposal], "won"), { selected: proposal, explicit: false });
  assert.deepEqual(resolveOpportunitySelection([], "won"), { selected: undefined, explicit: false });
});

test("an explicitly selected visible row survives refetch and filter changes that keep it", () => {
  assert.deepEqual(resolveOpportunitySelection([won, proposal], "proposal"), { selected: proposal, explicit: true });
  assert.deepEqual(resolveOpportunitySelection([proposal, won], "proposal"), { selected: proposal, explicit: true });
});

test("rows group in pipeline order with the most recent update first and empty stages omitted", () => {
  assert.deepEqual(
    groupByStage([olderProposal, won, proposal]).map(({ stage, items }) => [stage, items.map((item) => item.id)]),
    [
      ["proposal", ["proposal", "older"]],
      ["won", ["won"]],
    ]
  );
  assert.equal(stageCounts([won, proposal, olderProposal]).get("proposal"), 2);
  assert.equal(stageCounts([won]).get("lead"), 0);
});

test("stage and selection are shareable URL state and unknown stages fall back to all", () => {
  assert.equal(opportunitiesHref("acme", {}), "/acme/summon/opportunities/");
  assert.equal(
    opportunitiesHref("acme", { stage: "won", opportunity: "o1" }),
    "/acme/summon/opportunities/?stage=won&opportunity=o1"
  );
  assert.equal(opportunitiesHref("acme", { stage: "all", opportunity: null }), "/acme/summon/opportunities/");
  assert.equal(parseStageFilter("won"), "won");
  assert.equal(parseStageFilter("archived"), "all");
  assert.equal(parseStageFilter(null), "all");
});
