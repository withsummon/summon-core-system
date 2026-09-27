import assert from "node:assert/strict";
import test from "node:test";
import type { FunctionArgs } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import type { api } from "@summon/convex/api";
import { changeDraftProject, hasScopedDraftSelections } from "../project-change.ts";
test("confirmed project change removes scoped references while retaining draft content, dates and captured revision", () => {
  const draft: FunctionArgs<typeof api.tasks.drafts.index.save> = {
    draftId: "fixture-draft" as Id<"taskDrafts">,
    expectedContentRevision: 42,
    projectId: "fixture-old-project" as Id<"projects">,
    title: "Private task idea",
    html: "<p>Keep this text</p>",
    status: "in_progress",
    properties: {
      priority: "high",
      stateId: "fixture-state" as Id<"taskStates">,
      assigneeIds: ["fixture-user" as Id<"users">],
      labelIds: ["fixture-label" as Id<"taskLabels">],
      startDate: "2026-10-01",
      targetDate: "2026-10-02",
    },
    parent: { taskId: "fixture-parent" as Id<"tasks">, expectedUpdatedAt: 9 },
    cycle: { cycleId: "fixture-cycle" as Id<"cycles">, expectedCycleUpdatedAt: 10 },
    modules: [{ moduleId: "fixture-module" as Id<"modules">, expectedModuleUpdatedAt: 11 }],
  };
  assert.equal(hasScopedDraftSelections(draft), true);
  const changed = changeDraftProject(draft, null);
  assert.equal(hasScopedDraftSelections(changed), false);
  assert.deepEqual(changed, {
    ...draft,
    projectId: null,
    properties: { ...draft.properties, stateId: null, assigneeIds: [], labelIds: [] },
    parent: null,
    cycle: null,
    modules: [],
  });
  assert.equal(draft.modules.length, 1);
  assert.equal(draft.properties.assigneeIds.length, 1);
});
