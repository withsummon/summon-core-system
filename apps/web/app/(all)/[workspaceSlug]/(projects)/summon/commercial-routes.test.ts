import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("commercial detail routes use persisted detail contracts", () => {
  assert.match(source("./clients/[clientId]/page.tsx"), /getClientDetail/);
  const opportunity = source("./opportunities/[opportunityId]/page.tsx");
  assert.match(opportunity, /getOpportunityDetail/);
  assert.match(opportunity, /<OpportunityInspector/);
  // The list and detail routes share one inspector, which owns the stage transition and refetch.
  const inspector = source("../../../../../core/components/summon/opportunities/opportunity-inspector.tsx");
  assert.match(inspector, /transitionOpportunity/);
  assert.match(inspector, /await onChanged\(\)/);
});

test("commercial routes expose list and detail paths", () => {
  const routes = source("../../../../routes/extended.ts");
  assert.match(routes, /summon\/clients\/:clientId/);
  assert.match(routes, /summon\/opportunities\/:opportunityId/);
});
