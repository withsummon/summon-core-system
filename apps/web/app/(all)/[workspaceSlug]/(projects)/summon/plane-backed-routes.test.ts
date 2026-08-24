import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("./", import.meta.url);

for (const route of ["projects", "tasks", "documents", "knowledge", "notifications"]) {
  test(`${route} stays an index over canonical records`, () => {
    const source = readFileSync(new URL(`${route}/page.tsx`, root), "utf8");
    assert.doesNotMatch(source, /createSummon(Task|Document|Page|File|Notification)/);
  });
}

test("PDF navigation exposes the completed Plane-backed routes before the native assistant action", () => {
  const constants = readFileSync(new URL("../../../../../../../packages/constants/src/summon.ts", root), "utf8");
  const sidebar = readFileSync(
    new URL("../../../../../core/components/workspace/sidebar/sidebar-menu-items.tsx", root),
    "utf8"
  );
  const routes = readFileSync(new URL("../../../../routes/extended.ts", root), "utf8");

  for (const path of ["tasks", "documents", "knowledge", "resources", "notifications"]) {
    assert.match(constants, new RegExp(`path: "${path}"`));
    assert.match(routes, new RegExp(`summon/${path}`));
  }
  const modules = constants.match(/SUMMON_MODULES = \[([\s\S]*?)\] as const/)?.[1] ?? "";
  assert.doesNotMatch(modules, /summon_assistant/);
  assert.match(sidebar, /SUMMON_ASSISTANT_NAVIGATION_ITEM/);
});

test("project creation opens in place from the Summon projects directory", () => {
  const projects = readFileSync(
    new URL("../../../../../core/components/summon/projects/projects-directory-root.tsx", root),
    "utf8"
  );

  assert.match(projects, /toggleCreateProjectModal\(true\)/);
  assert.match(projects, />Create Project</);
  assert.doesNotMatch(projects, /Create Plane Project/);
  assert.doesNotMatch(projects, /href={`\/\$\{workspaceSlug\}\/projects\/`}/);
});

test("Summon create closes after the canonical project request", () => {
  const workspaceModals = readFileSync(
    new URL("../../../../../core/components/modals/workspace-level.tsx", root),
    "utf8"
  );
  const createModal = readFileSync(
    new URL("../../../../../core/components/project/create-project-modal.tsx", root),
    "utf8"
  );

  assert.match(workspaceModals, /summonProjectCreateOptions\(pathname\)/);
  assert.match(createModal, /if \(closeOnCreate\)/);
  assert.match(createModal, /onClose\(\)/);
});

test("meeting scheduling honors the project query parameter", () => {
  const meetings = readFileSync(new URL("meetings/page.tsx", root), "utf8");
  assert.match(meetings, /useSearchParams\(\)/);
  assert.match(meetings, /searchParams\.get\("project"\)/);
});
