import assert from "node:assert/strict";
import test from "node:test";
import type { Id } from "@summon/convex/data-model";
import { portfolioProjects } from "../portfolio-data.ts";
const projectId = "project-fixture" as Id<"projects">;
const project = { id: projectId, name: "Delivery", identifier: "DEL", health: "on_track" };
const counts = { total: 0, completed: 0, overdue: 0, dueInSevenDays: 0, later: 0, noDueDate: 0, completionTrend: {} };
test("complete contributions combine project task counts across sparse pages without summing percentages", () => {
  const result = portfolioProjects(
    [
      { count: 0, projects: [] },
      { count: 1, projects: [project] },
    ],
    [
      { ...counts, projects: { [projectId]: { total: 1, completed: 1 } } },
      { ...counts, projects: {} },
      { ...counts, projects: { [projectId]: { total: 3, completed: 0 } } },
    ]
  );
  assert.deepEqual(result, [{ ...project, completion: 25 }]);
});
test("authorized projects without active tasks retain legacy zero completion", () => {
  assert.deepEqual(portfolioProjects([{ count: 1, projects: [project] }], []), [{ ...project, completion: 0 }]);
});
