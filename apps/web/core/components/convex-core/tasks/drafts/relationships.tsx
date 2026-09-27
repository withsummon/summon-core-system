import { usePaginatedQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { SummonField } from "@/components/summon/forms";
import { selectClass } from "../../commercial/forms";
type Draft = FunctionArgs<typeof api.tasks.drafts.index.save>;
export function DraftRelationships({
  projectId,
  draft,
  onChange,
}: {
  projectId: Id<"projects">;
  draft: Draft;
  onChange: (draft: Draft) => void;
}) {
  const tasks = usePaginatedQuery(api.tasks.index.list, { projectId }, { initialNumItems: 30 });
  const cycles = usePaginatedQuery(api.cycles.index.list, { projectId, deleted: false }, { initialNumItems: 30 });
  const modules = usePaginatedQuery(api.modules.index.list, { projectId, deleted: false }, { initialNumItems: 30 });
  return (
    <section className="space-y-4 border-t border-subtle-1 pt-4">
      <h3 className="text-16 font-medium">Project relationships</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <SummonField label="Parent task" htmlFor="draft-parent">
            <select
              id="draft-parent"
              className={selectClass}
              value={draft.parent?.taskId ?? ""}
              onChange={(event) => {
                const task = tasks.results.find((item) => item._id === event.target.value);
                if (!event.target.value) onChange({ ...draft, parent: null });
                else if (task) onChange({ ...draft, parent: { taskId: task._id, expectedUpdatedAt: task.updatedAt } });
              }}
            >
              <option value="">No parent</option>
              {draft.parent && !tasks.results.some((task) => task._id === draft.parent?.taskId) && (
                <option value={draft.parent.taskId}>Selected parent unavailable or not loaded</option>
              )}
              {tasks.results.map((task) => (
                <option key={task._id} value={task._id}>
                  #{task.sequence} · {task.title}
                </option>
              ))}
            </select>
          </SummonField>
          {tasks.status === "CanLoadMore" && (
            <Button variant="secondary" onClick={() => tasks.loadMore(30)}>
              Load more parent tasks
            </Button>
          )}
        </div>
        <div className="space-y-2">
          <SummonField label="Cycle" htmlFor="draft-cycle">
            <select
              id="draft-cycle"
              className={selectClass}
              value={draft.cycle?.cycleId ?? ""}
              onChange={(event) => {
                const cycle = cycles.results.find((item) => item._id === event.target.value);
                if (!event.target.value) onChange({ ...draft, cycle: null });
                else if (cycle)
                  onChange({ ...draft, cycle: { cycleId: cycle._id, expectedCycleUpdatedAt: cycle.updatedAt } });
              }}
            >
              <option value="">No cycle</option>
              {draft.cycle && !cycles.results.some((cycle) => cycle._id === draft.cycle?.cycleId) && (
                <option value={draft.cycle.cycleId}>Selected cycle unavailable or not loaded</option>
              )}
              {cycles.results.map((cycle) => (
                <option key={cycle._id} value={cycle._id} disabled={cycle.archived}>
                  {cycle.name}
                  {cycle.archived ? " (archived)" : ""}
                </option>
              ))}
            </select>
          </SummonField>
          {cycles.status === "CanLoadMore" && (
            <Button variant="secondary" onClick={() => cycles.loadMore(30)}>
              Load more cycles
            </Button>
          )}
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-14 font-medium">Modules</legend>
        {modules.results.map((module) => (
          <label key={module._id} className="flex gap-2 text-14">
            <input
              type="checkbox"
              checked={draft.modules.some((ref) => ref.moduleId === module._id)}
              disabled={module.archived && !draft.modules.some((ref) => ref.moduleId === module._id)}
              onChange={(event) =>
                onChange({
                  ...draft,
                  modules: event.target.checked
                    ? [...draft.modules, { moduleId: module._id, expectedModuleUpdatedAt: module.updatedAt }]
                    : draft.modules.filter((ref) => ref.moduleId !== module._id),
                })
              }
            />
            {module.name}
            {module.archived ? " (archived)" : ""}
          </label>
        ))}
        {draft.modules
          .filter((ref) => !modules.results.some((module) => module._id === ref.moduleId))
          .map((ref) => (
            <label key={ref.moduleId} className="flex gap-2 text-14">
              <input
                type="checkbox"
                checked
                onChange={() =>
                  onChange({ ...draft, modules: draft.modules.filter((item) => item.moduleId !== ref.moduleId) })
                }
              />
              Selected module unavailable or not loaded ({ref.moduleId})
            </label>
          ))}
        {modules.status === "CanLoadMore" && (
          <Button variant="secondary" onClick={() => modules.loadMore(30)}>
            Load more modules
          </Button>
        )}
      </fieldset>
    </section>
  );
}
