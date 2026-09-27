import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
type Favorite = Pick<FunctionReturnType<typeof api.favorites.index.list>["page"][number], "target" | "entity">;
export function favoriteRoute(workspaceSlug: string, row: Favorite) {
  const params = new URLSearchParams({ workspace: workspaceSlug });
  const target = row.target;
  if (target.type === "folder") return null;
  if (target.type === "page") {
    params.set("module", "documents");
    params.set("document", target.id);
  } else if (target.type === "view" && row.entity.projectId === null) {
    params.set("module", "views");
    params.set("savedView", target.id);
  } else {
    if (!row.entity.projectIdentifier) return null;
    params.set("module", "projects");
    params.set("project", row.entity.projectIdentifier);
    if (target.type === "issue") {
      params.set("task", target.id);
      params.set("projectView", "tasks");
    } else if (target.type === "cycle") {
      params.set("projectView", "cycles");
      params.set("cycle", target.id);
    } else if (target.type === "module") {
      params.set("projectView", "modules");
      params.set("projectModule", target.id);
    } else if (target.type === "view") {
      params.set("projectView", "views");
      params.set("savedView", target.id);
    }
  }
  return `/core?${params}`;
}
