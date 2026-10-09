import { projectTabs } from "@summon/convex/project-navigation";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { clearProjectEntitySelection } from "./order-selection.ts";
type Navigation = FunctionReturnType<typeof api.projects.navigation.get>["navigation"];
export function projectSection(params: URLSearchParams, navigation: Navigation) {
  const explicit = params.get("projectView");
  if (explicit) return explicit;
  if (params.has("task") || params.has("taskView") || params.has("comment")) return "tasks";
  if (params.has("cycle") || params.has("cycleView")) return "cycles";
  if (params.has("projectModule") || params.has("moduleView")) return "modules";
  if (params.has("intake") || params.has("intakeStatus")) return "intake";
  if (params.has("savedView") || params.has("savedViewTab")) return "views";
  return projectTabs[navigation.defaultTab].view;
}
export function projectSectionParams(current: URLSearchParams, view: string) {
  const next = clearProjectEntitySelection(current);
  next.set("projectView", view);
  return next;
}
