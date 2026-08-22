import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("commercial detail routes use persisted detail contracts", () => {
  assert.match(source("./clients/[clientId]/page.tsx"), /getClientDetail/);
  const opportunity = source("./opportunities/[opportunityId]/page.tsx");
  assert.match(opportunity, /getOpportunityDetail/);
  assert.match(opportunity, /transitionOpportunity/);
  assert.match(opportunity, /await mutate\(\)/);
});

test("commercial routes expose list and detail paths", () => {
  const routes = source("../../../../routes/extended.ts");
  assert.match(routes, /summon\/clients\/:clientId/);
  assert.match(routes, /summon\/opportunities\/:opportunityId/);
});
