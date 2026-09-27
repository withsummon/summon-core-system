import assert from "node:assert/strict";
import test from "node:test";
import type { Id } from "@summon/convex/data-model";
import { favoriteRoute } from "../route.ts";
const projectId = "fixture-project" as Id<"projects">;
const entity = { name: "A task", projectId, projectIdentifier: "NATIVE", canFavorite: true };
test("task favorite uses canonical project identifier and a clean task route", () => {
  const href = favoriteRoute("northstar", { target: { type: "issue", id: "fixture-task" as Id<"tasks"> }, entity });
  assert.ok(href);
  assert.deepEqual(Object.fromEntries(new URL(href, "http://localhost").searchParams), {
    workspace: "northstar",
    module: "projects",
    projectView: "tasks",
    project: "NATIVE",
    task: "fixture-task",
  });
});
test("project and workspace view favorites preserve their distinct route owners", () => {
  const target = { type: "view", id: "fixture-view" as Id<"savedViews"> } as const;
  const project = favoriteRoute("northstar", { target, entity });
  const workspace = favoriteRoute("northstar", {
    target,
    entity: { ...entity, projectId: null, projectIdentifier: null },
  });
  assert.ok(project);
  assert.ok(workspace);
  const scoped = new URL(project, "http://localhost").searchParams,
    global = new URL(workspace, "http://localhost").searchParams;
  assert.equal(scoped.get("projectView"), "views");
  assert.equal(scoped.get("project"), "NATIVE");
  assert.equal(scoped.get("savedView"), "fixture-view");
  assert.equal(global.get("module"), "views");
  assert.equal(global.has("project"), false);
  assert.equal(global.get("savedView"), "fixture-view");
});
test("document and nested entity favorites reach their native selected detail", () => {
  const cases = [
    {
      target: { type: "page", id: "fixture-document" as Id<"documents"> } as const,
      key: "document",
      value: "fixture-document",
    },
    { target: { type: "cycle", id: "fixture-cycle" as Id<"cycles"> } as const, key: "cycle", value: "fixture-cycle" },
    {
      target: { type: "module", id: "fixture-module" as Id<"modules"> } as const,
      key: "projectModule",
      value: "fixture-module",
    },
  ];
  for (const item of cases) {
    const href = favoriteRoute("northstar", { target: item.target, entity });
    assert.ok(href);
    assert.equal(new URL(href, "http://localhost").searchParams.get(item.key), item.value);
  }
  assert.equal(favoriteRoute("northstar", { target: { type: "folder" }, entity }), null);
});
