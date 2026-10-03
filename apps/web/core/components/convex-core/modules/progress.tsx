import { usePaginatedQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { TaskProgressPanel } from "../tasks/progress/panel";
export function ModuleProgress({ moduleId }: { moduleId: Id<"modules"> }) {
  const progress = usePaginatedQuery(api.modules.progress.page, { moduleId }, { initialNumItems: 20 });
  return <TaskProgressPanel progress={progress} scope="module" />;
}
