import assert from "node:assert/strict";
import test from "node:test";
import type { ISummonResourceLink } from "@plane/types";
const { filterProjectResources, mergeProjectSummaries, projectProfileDateError, summonProjectCreateOptions } =
  (await import(new URL("./project-workspace.ts", import.meta.url).href)) as typeof import("./project-workspace");

test("Summon project directory uses the one-step create flow without a default cover", () => {
  assert.deepEqual(summonProjectCreateOptions("/core/summon/projects/"), {
    closeOnCreate: true,
    data: { cover_image_url: "" },
  });
  assert.deepEqual(summonProjectCreateOptions("/core/projects/"), {});
  assert.deepEqual(summonProjectCreateOptions("/core/summon/projects/project-id/"), {});
});

test("new Plane projects appear immediately while summary metrics stay canonical", () => {
  assert.deepEqual(
    mergeProjectSummaries(
      [{ id: "existing", identifier: "OLD", name: "Existing", health: "at_risk", completion: 60 }],
      [
        { id: "existing", identifier: "OLD", name: "Existing" },
        { id: "created", identifier: "NEW", name: "Created" },
      ]
    ),
    [
      { id: "existing", identifier: "OLD", name: "Existing", health: "at_risk", completion: 60 },
      { id: "created", identifier: "NEW", name: "Created", health: "on_track", completion: 0 },
    ]
  );
});

test("project resource tabs use authoritative categories", () => {
  const resources = [
    { id: "repo", category: "repository" },
    { id: "deploy", category: "deployment" },
    { id: "figma", category: "figma" },
  ] as ISummonResourceLink[];

  assert.deepEqual(
    filterProjectResources(resources, "repository").map(({ id }) => id),
    ["repo"]
  );
  assert.deepEqual(
    filterProjectResources(resources, "deployment").map(({ id }) => id),
    ["deploy"]
  );
});

test("project profile rejects an inverted date range", () => {
  assert.equal(projectProfileDateError("2026-09-01", "2026-08-31"), "Start date must not be after target date.");
  assert.equal(projectProfileDateError("2026-08-01", "2026-08-31"), "");
  assert.equal(projectProfileDateError("", "2026-08-31"), "");
});
