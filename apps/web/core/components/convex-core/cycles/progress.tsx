import { usePaginatedQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { TaskProgressPanel } from "../tasks/progress/panel";
export function CycleProgress({ cycleId }: { cycleId: Id<"cycles"> }) {
  const progress = usePaginatedQuery(api.cycles.progress.page, { cycleId }, { initialNumItems: 20 });
  return <TaskProgressPanel progress={progress} scope="cycle" />;
}
