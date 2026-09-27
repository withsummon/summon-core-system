import { EstimateSelection } from "../estimates/selection";
import { usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { selectClass } from "../commercial/forms";
import { statusOptions } from "./options";
export type TaskPropertyValues = Pick<
  FunctionArgs<typeof api.tasks.index.update>,
  "priority" | "assigneeIds" | "labelIds" | "startDate" | "targetDate" | "stateId" | "estimatePointId"
> &
  Pick<FunctionArgs<typeof api.tasks.drafts.index.save>, "status">;
const priorities = ["none", "urgent", "high", "medium", "low"] as const satisfies TaskPropertyValues["priority"][];
export function TaskProperties<T extends TaskPropertyValues>({
  projectId,
  draft,
  onChange,
  allowDefaultState = false,
}: {
  projectId: Id<"projects"> | null;
  allowDefaultState?: boolean;
  draft: T;
  onChange: (draft: T) => void;
}) {
  const states = useQuery(api.tasks.states.list, projectId ? { projectId } : "skip");
  const labels = useQuery(api.tasks.labels.list, projectId ? { projectId } : "skip");
  const {
    results: members,
    status,
    loadMore,
  } = usePaginatedQuery(api.tasks.assignees.list, projectId ? { projectId } : "skip", { initialNumItems: 100 });
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <SummonField label="State" htmlFor="task-state">
        <select
          id="task-state"
          className={selectClass}
          value={draft.stateId ?? draft.status ?? ""}
          onChange={(event) => {
            if (allowDefaultState && event.target.value === "") {
              onChange({ ...draft, stateId: null, status: null });
              return;
            }
            const state = states?.find((item) => item._id === event.target.value);
            if (state) onChange({ ...draft, stateId: state._id, status: state.status });
            else {
              const group = statusOptions.find((item) => item.value === event.target.value);
              if (group) onChange({ ...draft, stateId: null, status: group.value });
            }
          }}
        >
          {allowDefaultState && <option value="">Project default at publication</option>}
          <optgroup label="Status groups">
            {statusOptions.map((item) => (
              <option value={item.value} key={item.value}>
                {item.label}
              </option>
            ))}
          </optgroup>
          {draft.stateId && !states?.some((state) => state._id === draft.stateId) && (
            <option value={draft.stateId}>Selected state unavailable or not loaded</option>
          )}
          <optgroup label="Project states">
            {states?.map((state) => (
              <option value={state._id} key={state._id}>
                {state.name}
              </option>
            ))}
          </optgroup>
        </select>
      </SummonField>
      <SummonField label="Priority" htmlFor="task-priority">
        <select
          id="task-priority"
          className={selectClass}
          value={draft.priority}
          onChange={(event) => {
            const priority = priorities.find((value) => value === event.target.value);
            if (priority) onChange({ ...draft, priority });
          }}
        >
          {priorities.map((priority) => (
            <option value={priority} key={priority}>
              {priority.charAt(0).toUpperCase() + priority.slice(1)}
            </option>
          ))}
        </select>
      </SummonField>
      <EstimateSelection
        projectId={projectId}
        value={draft.estimatePointId}
        onChange={(estimatePointId) => onChange({ ...draft, estimatePointId })}
      />
      <SummonField label="Start date">
        <Input
          type="date"
          value={draft.startDate ?? ""}
          max={draft.targetDate ?? undefined}
          onChange={(event) => onChange({ ...draft, startDate: event.target.value || null })}
        />
      </SummonField>
      <SummonField label="Due date">
        <Input
          type="date"
          value={draft.targetDate ?? ""}
          min={draft.startDate ?? undefined}
          onChange={(event) => onChange({ ...draft, targetDate: event.target.value || null })}
        />
      </SummonField>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-14 font-medium">Assignees</legend>
        {members.map((member) => (
          <label key={member.id} className="flex gap-2 text-14">
            <input
              type="checkbox"
              checked={draft.assigneeIds.includes(member.id)}
              onChange={(event) =>
                onChange({
                  ...draft,
                  assigneeIds: event.target.checked
                    ? [...draft.assigneeIds, member.id]
                    : draft.assigneeIds.filter((id) => id !== member.id),
                })
              }
            />
            {member.name || member.email || member.id}
          </label>
        ))}
        {status === "CanLoadMore" && (
          <Button variant="secondary" onClick={() => loadMore(100)}>
            Load more members
          </Button>
        )}
        {draft.assigneeIds
          .filter((id) => !members.some((member) => member.id === id))
          .map((id) => (
            <label key={id} className="flex gap-2 text-14">
              <input
                type="checkbox"
                checked
                onChange={() => onChange({ ...draft, assigneeIds: draft.assigneeIds.filter((value) => value !== id) })}
              />
              Member unavailable or not loaded ({id})
            </label>
          ))}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-14 font-medium">Labels</legend>
        {labels?.map((label) => (
          <label key={label._id} className="flex gap-2 text-14">
            <input
              type="checkbox"
              checked={draft.labelIds.includes(label._id)}
              onChange={(event) =>
                onChange({
                  ...draft,
                  labelIds: event.target.checked
                    ? [...draft.labelIds, label._id]
                    : draft.labelIds.filter((id) => id !== label._id),
                })
              }
            />
            <span style={{ color: label.color }} aria-hidden>
              ●
            </span>
            {label.name}
          </label>
        ))}
        {draft.labelIds
          .filter((id) => !labels?.some((label) => label._id === id))
          .map((id) => (
            <label key={id} className="flex gap-2 text-14">
              <input
                type="checkbox"
                checked
                onChange={() => onChange({ ...draft, labelIds: draft.labelIds.filter((value) => value !== id) })}
              />
              Label unavailable or not loaded ({id})
            </label>
          ))}
        {labels?.length === 0 && <p className="text-14 text-secondary">No project labels yet.</p>}
      </fieldset>
    </div>
  );
}
