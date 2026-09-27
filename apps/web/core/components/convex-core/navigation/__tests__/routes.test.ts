import assert from "node:assert/strict";
import test from "node:test";
import { preferenceRoute, reorderPreferences } from "../routes.ts";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
test("personal shortcuts target actual native owners and workspace cycles needs no project selection", () => {
  const cycle = new URL(preferenceRoute("north", "active_cycles"), "http://localhost");
  assert.equal(cycle.searchParams.get("module"), "cycles");
  assert.equal(cycle.searchParams.has("projectView"), false);
  assert.equal(cycle.searchParams.has("project"), false);
  const draft = new URL(preferenceRoute("north", "drafts")!, "http://localhost");
  assert.equal(draft.searchParams.get("taskSection"), "drafts");
  const mine = new URL(preferenceRoute("north", "your_work")!, "http://localhost");
  assert.equal(mine.searchParams.get("scope"), "mine");
  const archive = new URL(preferenceRoute("north", "archives")!, "http://localhost");
  assert.equal(archive.searchParams.get("projectView"), "archived");
});
test("reordering equal stored ranks captures every revision and preserves the input snapshot", () => {
  type Row = FunctionReturnType<typeof api.navigation.preferences.list>["preferences"][number];
  const rows: Row[] = ["views", "drafts", "stickies"].map((key, index) => ({
    _id: `row${index}` as Id<"sidebarPreferences">,
    _creationTime: index,
    workspaceId: "workspace" as Id<"workspaces">,
    userId: "user" as Id<"users">,
    key: key as Row["key"],
    revision: index + 5,
    sortOrder: 10,
    isPinned: true,
  }));
  const changes = reorderPreferences(rows, 1, -1);
  assert.deepEqual(
    changes.map((row) => row.key),
    ["drafts", "views", "stickies"]
  );
  assert.deepEqual(
    changes.map((row) => row.expectedRevision),
    [6, 5, 7]
  );
  assert.deepEqual(
    changes.map((row) => row.sortOrder),
    [65535, 75535, 85535]
  );
  assert.deepEqual(
    rows.map((row) => row.key),
    ["views", "drafts", "stickies"]
  );
  assert.deepEqual(reorderPreferences(rows, 0, -1), []);
});
