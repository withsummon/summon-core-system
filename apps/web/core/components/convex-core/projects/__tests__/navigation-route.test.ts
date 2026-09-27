import assert from "node:assert/strict";
import test from "node:test";
import { projectSection, projectSectionParams } from "../navigation-route.ts";
const preferences = { defaultTab: "cycles", hiddenTabs: [] } as const;
test("personal default applies only to bare project; explicit task and entity links win", () => {
  const navigation = { ...preferences, hiddenTabs: [] };
  assert.equal(projectSection(new URLSearchParams("workspace=team&project=ONE"), navigation), "cycles");
  for (const [query, expected] of [
    ["projectView=tasks", "tasks"],
    ["task=one", "tasks"],
    ["taskView=archived", "tasks"],
    ["projectModule=one", "modules"],
    ["intakeStatus=pending", "intake"],
    ["savedView=one", "views"],
    ["projectView=overview", "overview"],
    ["projectView=settings", "settings"],
  ])
    assert.equal(projectSection(new URLSearchParams(query), navigation), expected);
});
test("explicit section selection preserves project/workspace and clears stale entities", () => {
  const current = new URLSearchParams(
    "workspace=team&module=projects&project=ONE&task=one&comment=two&cycle=old&projectModule=old&intake=old&savedView=old"
  );
  const next = projectSectionParams(current, "tasks");
  assert.equal(next.get("projectView"), "tasks");
  assert.equal(next.get("workspace"), "team");
  assert.equal(next.get("project"), "ONE");
  for (const key of ["task", "comment", "cycle", "projectModule", "intake", "savedView"])
    assert.equal(next.has(key), false);
  assert.equal(current.get("task"), "one");
});
