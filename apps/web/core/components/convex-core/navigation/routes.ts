import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
type Preference = FunctionReturnType<typeof api.navigation.preferences.list>["preferences"][number];
export const preferenceLabels: Record<Preference["key"], string> = {
  views: "Views",
  active_cycles: "Workspace cycles",
  analytics: "Reports",
  drafts: "Drafts",
  your_work: "My tasks",
  archives: "Archived projects",
  stickies: "Stickies",
};
export function preferenceRoute(workspace: string, key: Preference["key"]) {
  const params = new URLSearchParams({ workspace });
  switch (key) {
    case "views":
      params.set("module", "views");
      break;
    case "active_cycles":
      params.set("module", "cycles");
      break;
    case "analytics":
      params.set("module", "reports");
      break;
    case "drafts":
      params.set("module", "tasks");
      params.set("taskSection", "drafts");
      break;
    case "your_work":
      params.set("module", "tasks");
      params.set("scope", "mine");
      break;
    case "archives":
      params.set("module", "projects");
      params.set("projectView", "archived");
      break;
    case "stickies":
      params.set("module", "stickies");
      break;
  }
  return `/core?${params}`;
}
export function reorderPreferences(rows: Preference[], index: number, direction: -1 | 1) {
  const adjacent = rows[index + direction];
  const row = rows[index];
  if (!row || !adjacent) return [];
  // Normalize the bounded seven-row order, including pre-existing equal ranks.
  const ordered = [...rows];
  [ordered[index], ordered[index + direction]] = [adjacent, row];
  return ordered.map((item, position) => ({
    key: item.key,
    expectedRevision: item.revision,
    sortOrder: 65535 + position * 10000,
  }));
}
