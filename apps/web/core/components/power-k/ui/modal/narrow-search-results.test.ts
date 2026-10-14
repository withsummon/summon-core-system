import assert from "node:assert/strict";
import test from "node:test";
import type { IWorkspaceSearchResults } from "@plane/types";
import { narrowSearchResults } from "./narrow-search-results";

const issue = (name: string, sequence_id: number) => ({
  id: name,
  name,
  sequence_id,
  project__identifier: "AURA",
  project_id: "aura",
  workspace__slug: "acme",
});

const response = (term: string, issues: ReturnType<typeof issue>[]) => ({
  term,
  results: {
    results: { workspace: [], project: [], issue: issues, cycle: [], module: [], issue_view: [], page: [] },
  } as unknown as IWorkspaceSearchResults,
});

const names = (results: IWorkspaceSearchResults) => results.results.issue.map((item) => item.name);

test("narrows the previous term's results while a longer term is in flight", () => {
  const previous = response("sus", [issue("Susun WBS", 1), issue("Sustain plan", 2)]);
  assert.deepEqual(names(narrowSearchResults(previous, "susun")), ["Susun WBS"]);
});

test("keeps work items that match by reference", () => {
  const previous = response("aura", [issue("Credit scoring", 4), issue("Vendor review", 12)]);
  assert.deepEqual(names(narrowSearchResults(previous, "aura-4")), ["Credit scoring"]);
});

test("returns results untouched for the term they were fetched for", () => {
  const current = response("pemulhan", [issue("Rencana pemulihan", 1)]);
  assert.equal(narrowSearchResults(current, "pemulhan"), current.results);
});

test("drops stale results that the new term rules out", () => {
  const previous = response("susun", [issue("Susun WBS", 1), issue("Susun rencana pemulihan", 2)]);
  assert.deepEqual(names(narrowSearchResults(previous, "rencana")), ["Susun rencana pemulihan"]);
});
