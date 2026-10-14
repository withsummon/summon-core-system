import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const modelSource = readFileSync(new URL("./knowledge-model.ts", import.meta.url), "utf8");
const modelUrl = `data:text/javascript;base64,${Buffer.from(
  ts.transpileModule(modelSource, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
  }).outputText
).toString("base64")}`;
// SAFETY: The loaded module is a direct TypeScript transpilation of knowledge-model.ts above.
const model = (await import(modelUrl)) as typeof import("./knowledge-model");
const {
  askHref,
  categoryLabel,
  contextOptionsFor,
  filterKnowledge,
  knowledgeCategories,
  knowledgeEntries,
  knowledgeStats,
  pageHref,
  recentFirst,
  starterQuestions,
} = model;

type TEntry = Parameters<typeof filterKnowledge>[0][number];

const entry = (
  id: string,
  name: string,
  project: [string, string],
  updated: string,
  context?: Partial<NonNullable<TEntry["context"]>>
): TEntry => ({
  page: { id, name, updated_at: updated },
  project: { id: project[0], name: project[1] },
  context: context ? { client: null, opportunity: null, category: "", ...context } : undefined,
});

const aura: [string, string] = ["p-aura", "AURA Credit Scoring"];
const pln: [string, string] = ["p-pln", "PLN AI SOC"];
const entries = [
  entry("1", "Kickoff notes", aura, "2026-10-01T00:00:00Z", { category: "meeting_notes", client: "c-bank" }),
  entry("2", "Runbook", pln, "2026-10-12T00:00:00Z", { category: "process", opportunity: "o-1" }),
  entry("3", "Scoring model", aura, "2026-10-13T00:00:00Z"),
];

test("library sorts newest first and lists only categories in use", () => {
  assert.deepEqual(
    recentFirst(entries).map((item) => item.page.id),
    ["3", "2", "1"]
  );
  assert.deepEqual(knowledgeCategories(entries), ["meeting_notes", "process"]);
  assert.equal(categoryLabel("lessons_learned"), "Lessons learned");
  assert.equal(categoryLabel(""), "Page");
});

test("search, category and context narrow the library together", () => {
  const all = { query: "", category: "all", context: "all" as const };
  assert.equal(filterKnowledge(entries, all).length, 3);
  assert.deepEqual(
    filterKnowledge(entries, { ...all, query: "aura" }).map((item) => item.page.id),
    ["1", "3"]
  );
  assert.deepEqual(
    filterKnowledge(entries, { ...all, category: "process" }).map((item) => item.page.id),
    ["2"]
  );
  assert.deepEqual(
    filterKnowledge(entries, { ...all, context: "project:p-aura" }).map((item) => item.page.id),
    ["1", "3"]
  );
  assert.deepEqual(
    filterKnowledge(entries, { ...all, context: "client:c-bank" }).map((item) => item.page.id),
    ["1"]
  );
  assert.deepEqual(
    filterKnowledge(entries, { ...all, context: "opportunity:o-1" }).map((item) => item.page.id),
    ["2"]
  );
  assert.equal(filterKnowledge(entries, { ...all, query: "aura", category: "process" }).length, 0);
});

test("asking hands the question to the Assistant composer and pages link into Plane", () => {
  assert.equal(askHref("local", "  what's due? "), "/local/summon/assistant/?q=what's%20due%3F");
  assert.equal(pageHref("local", entries[0]), "/local/projects/p-aura/pages/1/");
});

test("starter questions come from recent pages and are empty without any", () => {
  assert.deepEqual(starterQuestions([]), []);
  const questions = starterQuestions(recentFirst(entries));
  assert.equal(questions.length, 3);
  assert.match(questions[0], /AURA Credit Scoring/);
  assert.match(questions[1], /Scoring model/);
  assert.match(questions[2], /PLN AI SOC/);
});

test("pages join their Summon context and stats count only real records", () => {
  const joined = knowledgeEntries(
    [
      {
        page: { id: "a", updated_at: "2026-10-01T00:00:00Z", created_by: "u1", updated_by: "u2" },
        project: { id: "p", name: "P" },
      },
      { page: { id: "b", updated_at: "2026-10-13T00:00:00Z", created_by: "u1" }, project: { id: "q", name: "Q" } },
    ],
    [{ page: "a", client: "c", opportunity: null, category: "process" }]
  );
  assert.deepEqual(
    joined.map((item) => [item.page.id, item.context?.category]),
    [
      ["b", undefined],
      ["a", "process"],
    ]
  );
  assert.deepEqual(knowledgeStats(joined, Date.parse("2026-10-14T00:00:00Z")), {
    pages: 2,
    projects: 2,
    updatedThisWeek: 1,
    contributors: 2,
  });
});

test("context options list only records that have pages, and no deals unless passed", () => {
  const clients = [
    { id: "c-bank", name: "Bank" },
    { id: "c-idle", name: "Idle client" },
  ];
  const options = contextOptionsFor(entries, clients, [{ id: "o-1", title: "Renewal" }]);
  assert.deepEqual(
    options.project.map((option) => option.label),
    ["AURA Credit Scoring", "PLN AI SOC"]
  );
  assert.deepEqual(options.client, [{ id: "c-bank", label: "Bank" }]);
  assert.deepEqual(options.opportunity, [{ id: "o-1", label: "Renewal" }]);
  assert.deepEqual(contextOptionsFor(entries, clients, []).opportunity, []);
});
