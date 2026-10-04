import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { taskDisplayPropertiesSchema } from "@summon/convex/task-schema";
import { Button } from "@plane/propel/button";
import { CustomMenu } from "@plane/ui";
import { TaskLifecycle, NativeTaskRow, useTaskLifecycle } from "@/components/convex-core/tasks/lifecycle";
import { TaskRowPropertyControls, useTaskPropertyWriter } from "@/components/convex-core/tasks/task-properties";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { calculateIdentifierWidth } from "../utils";
import { NativeCalendar } from "../calendar/roots/project-view-root";
import { NativeTimeline } from "../gantt/blocks";

type Tasks = FunctionReturnType<typeof api.savedViews.results.list>["page"];
type Address = FunctionReturnType<typeof api.navigation.address.resolveProjectId>;
type Display = NonNullable<FunctionArgs<typeof api.savedViews.index.create>["displayFilters"]>;
type Properties = NonNullable<FunctionArgs<typeof api.savedViews.index.create>["displayProperties"]>;
const groupLabels = {
  stateId: "State",
  priority: "Priority",
  cycleId: "Cycle",
  moduleId: "Module",
  labelId: "Label",
  assigneeId: "Assignee",
  createdBy: "Created by",
};

function useGroupCatalogs(projectId: Address["project"]["_id"], display: Display) {
  const groups = new Set([display.groupBy, display.subGroupBy]);
  const needsStates = groups.has("stateId"),
    needsLabels = groups.has("labelId"),
    needsPeople = groups.has("assigneeId") || groups.has("createdBy");
  const needsCycles = groups.has("cycleId"),
    needsModules = groups.has("moduleId");
  const states = useQuery(api.tasks.states.list, needsStates ? { projectId } : "skip");
  const labels = useQuery(api.tasks.labels.list, needsLabels ? { projectId } : "skip");
  const people = useQuery(api.projects.index.members, needsPeople ? { projectId } : "skip");
  const cycles = usePaginatedQuery(api.cycles.index.list, needsCycles ? { projectId, deleted: false } : "skip", {
    initialNumItems: 100,
  });
  const modules = usePaginatedQuery(api.modules.index.list, needsModules ? { projectId, deleted: false } : "skip", {
    initialNumItems: 100,
  });
  return {
    states,
    labels,
    people,
    cycles: cycles.results,
    modules: modules.results,
    complete:
      (!needsStates || !!states) &&
      (!needsLabels || !!labels) &&
      (!needsPeople || !!people) &&
      (!needsCycles || cycles.status === "Exhausted") &&
      (!needsModules || modules.status === "Exhausted"),
    canLoadMore: cycles.status === "CanLoadMore" || modules.status === "CanLoadMore",
    loadMore: () => {
      if (cycles.status === "CanLoadMore") cycles.loadMore(100);
      if (modules.status === "CanLoadMore") modules.loadMore(100);
    },
  };
}
function groupOptions(kind: Display["groupBy"], catalogs: ReturnType<typeof useGroupCatalogs>) {
  switch (kind) {
    case "stateId":
      return (catalogs.states ?? []).map((row) => ({ id: row._id, name: row.name }));
    case "priority":
      return ["urgent", "high", "medium", "low", "none"].map((id) => ({ id, name: id }));
    case "cycleId":
      return catalogs.cycles.map((row) => ({ id: row._id, name: row.name }));
    case "moduleId":
      return catalogs.modules.map((row) => ({ id: row._id, name: row.name }));
    case "labelId":
      return (catalogs.labels ?? []).map((row) => ({ id: row._id, name: row.name }));
    case "assigneeId":
    case "createdBy":
      return (catalogs.people?.members ?? []).map((row) => ({ id: row.userId, name: row.displayName }));
    default:
      return [];
  }
}
function taskGroupIds(task: Tasks[number], kind: Display["groupBy"]): string[] {
  switch (kind) {
    case "stateId":
      return task.stateId ? [task.stateId] : [];
    case "priority":
      return [task.priority];
    case "cycleId":
      return task.cycle ? [task.cycle._id] : [];
    case "moduleId":
      return task.modules.map((row) => row._id);
    case "labelId":
      return task.labelIds;
    case "assigneeId":
      return task.assigneeIds;
    case "createdBy":
      return [task.createdBy];
    default:
      return [];
  }
}
function grouped(
  tasks: Tasks,
  kind: Display["groupBy"],
  catalogs: ReturnType<typeof useGroupCatalogs>,
  showEmpty: boolean
) {
  if (kind === null) return [{ id: "", name: "Work items", tasks }];
  const options = groupOptions(kind, catalogs);
  const ids = new Set(tasks.flatMap((task) => taskGroupIds(task, kind)));
  const groups = options.map((option) => ({
    ...option,
    tasks: tasks.filter((task) => taskGroupIds(task, kind).includes(option.id)),
  }));
  for (const id of ids)
    if (!options.some((option) => option.id === id))
      groups.push({
        id,
        name: "Unavailable selection",
        tasks: tasks.filter((task) => taskGroupIds(task, kind).includes(id)),
      });
  groups.push({
    id: "",
    name: `No ${groupLabels[kind].toLowerCase()}`,
    tasks: tasks.filter((task) => taskGroupIds(task, kind).length === 0),
  });
  return showEmpty ? groups : groups.filter((group) => group.tasks.length > 0);
}
function groupChange(
  task: Tasks[number],
  kind: Display["groupBy"],
  id: string,
  catalogs: ReturnType<typeof useGroupCatalogs>,
  sourceId: string
): Omit<FunctionArgs<typeof api.tasks.index.update>, "taskId" | "expectedUpdatedAt"> {
  switch (kind) {
    case "stateId": {
      const state = catalogs.states?.find((row) => row._id === id);
      return { stateId: state?._id ?? null };
    }
    case "priority": {
      const priority = (["urgent", "high", "medium", "low", "none"] as const).find((value) => value === id);
      if (priority) return { priority };
      return {};
    }
    case "assigneeId": {
      const user = catalogs.people?.members.find((row) => row.userId === id);
      return {
        assigneeIds: [
          ...new Set([...task.assigneeIds.filter((value) => value !== sourceId), ...(user ? [user.userId] : [])]),
        ],
      };
    }
    case "labelId": {
      const label = catalogs.labels?.find((row) => row._id === id);
      return {
        labelIds: [...new Set([...task.labelIds.filter((value) => value !== sourceId), ...(label ? [label._id] : [])])],
      };
    }
    case "cycleId": {
      const cycle = catalogs.cycles.find((row) => row._id === id);
      return {
        cycle: {
          previous: task.cycleReference,
          next: cycle ? { cycleId: cycle._id, expectedCycleUpdatedAt: cycle.updatedAt } : null,
        },
      };
    }
    case "moduleId": {
      const module = catalogs.modules.find((row) => row._id === id);
      return {
        modules: {
          previous: task.moduleReferences,
          next: [
            ...task.moduleReferences.filter((row) => row.moduleId !== sourceId && row.moduleId !== module?._id),
            ...(module ? [{ moduleId: module._id, expectedModuleUpdatedAt: module.updatedAt }] : []),
          ],
        },
      };
    }
    default:
      return {};
  }
}

export function ProjectViewLayoutRoot({
  tasks,
  address,
  displayFilters,
  displayProperties,
  cohortComplete,
}: {
  tasks: Tasks;
  address: Address;
  displayFilters: Display;
  displayProperties: Properties;
  cohortComplete: boolean;
}) {
  const catalogs = useGroupCatalogs(address.project._id, displayFilters);
  const update = useMutation(api.tasks.index.update);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const dragged = useRef<{ task: Tasks[number]; groupId: string; subgroupId: string } | null>(null);
  useReloadConfirmations(pending, "Work item changes are still saving.", undefined, pending);
  const save = async (
    task: Tasks[number],
    change: Omit<FunctionArgs<typeof api.tasks.index.update>, "taskId" | "expectedUpdatedAt">
  ) => {
    if (pending || !task.canEdit) return;
    setPending(true);
    setError("");
    try {
      await update({ taskId: task._id, expectedUpdatedAt: task.updatedAt, ...change });
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  };
  const drop = (
    groupId: string,
    subgroupId: string,
    position?: FunctionArgs<typeof api.tasks.index.update>["position"]
  ) => {
    const captured = dragged.current;
    dragged.current = null;
    if (!captured || pending || !cohortComplete || !catalogs.complete) return;
    const targets = [
      [displayFilters.groupBy, groupId, captured.groupId],
      [displayFilters.subGroupBy, subgroupId, captured.subgroupId],
    ] as const;
    try {
      for (const [kind, id, sourceId] of targets) {
        if (kind === "createdBy" && id !== sourceId) throw new Error("The creator cannot be changed.");
        if (id && !groupOptions(kind, catalogs).some((option) => option.id === id))
          throw new Error("This group is unavailable. Reload the latest view before moving this work item.");
      }
      const change = {
        ...(groupId === captured.groupId
          ? {}
          : groupChange(captured.task, displayFilters.groupBy, groupId, catalogs, captured.groupId)),
        ...(subgroupId === captured.subgroupId
          ? {}
          : groupChange(captured.task, displayFilters.subGroupBy, subgroupId, catalogs, captured.subgroupId)),
        ...(position ? { position } : {}),
      };
      if (Object.keys(change).length) void save(captured.task, change);
    } catch (failure) {
      setError(mutationMessage(failure));
    }
  };
  const renderTask = (
    task: Tasks[number],
    kanban = false,
    renderContent?: (row: ReactNode, writer: ReturnType<typeof useTaskPropertyWriter>) => ReactNode
  ) => (
    <NativeSavedViewTask
      task={task}
      address={address}
      displayProperties={displayProperties}
      kanban={kanban}
      disabled={pending}
      renderContent={renderContent}
    />
  );
  const dateProps = { tasks, address, displayFilters, displayProperties, cohortComplete, renderTask };
  if (displayFilters.layout === "calendar") return <NativeCalendar {...dateProps} />;
  if (displayFilters.layout === "gantt_chart") return <NativeTimeline {...dateProps} />;
  if (displayFilters.layout === "spreadsheet")
    return (
      <NativeSpreadsheet tasks={tasks} address={address} displayProperties={displayProperties} disabled={pending} />
    );
  const complete = cohortComplete && catalogs.complete;
  const groups = grouped(tasks, displayFilters.groupBy, catalogs, displayFilters.showEmptyGroups);
  return (
    <section className="min-w-0">
      {catalogs.canLoadMore && (
        <Button variant="secondary" onClick={catalogs.loadMore}>
          Load more groups
        </Button>
      )}
      {error && (
        <p role="alert" className="p-3 text-danger-primary">
          {error}
        </p>
      )}
      <div className={displayFilters.layout === "kanban" ? "flex min-h-80 gap-3 overflow-x-auto p-3" : "space-y-3"}>
        {groups.map((group) => (
          <section
            key={group.id}
            className={
              displayFilters.layout === "kanban" ? "w-80 shrink-0 rounded-md bg-layer-1" : "border-b border-subtle"
            }
            onDragOver={(event) => {
              if (complete && displayFilters.groupBy !== "createdBy") event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              const captured = dragged.current;
              if (captured) drop(group.id, captured.subgroupId);
            }}
          >
            {displayFilters.groupBy !== null && (
              <h2 className="flex items-center justify-between p-3 text-13 font-semibold">
                {group.name}
                {complete && <span className="text-secondary">{group.tasks.length}</span>}
              </h2>
            )}
            {grouped(group.tasks, displayFilters.subGroupBy, catalogs, displayFilters.showEmptyGroups).map(
              (subgroup) => (
                <div
                  key={subgroup.id}
                  onDragOver={(event) => {
                    if (complete) event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    drop(group.id, subgroup.id);
                  }}
                >
                  {displayFilters.subGroupBy !== null && (
                    <h3 className="px-3 py-2 text-12 font-medium">
                      {subgroup.name}
                      {complete ? ` · ${subgroup.tasks.length}` : ""}
                    </h3>
                  )}
                  <ul className={displayFilters.layout === "kanban" ? "space-y-2 p-2" : "divide-y divide-subtle"}>
                    {subgroup.tasks.map((task, index) => (
                      <li key={task._id}>
                        {renderTask(task, displayFilters.layout === "kanban", (row, writer) => (
                          <div
                            draggable={!writer.disabled && complete}
                            onDragStart={(event) => {
                              dragged.current = { task, groupId: group.id, subgroupId: subgroup.id };
                              event.dataTransfer.setData("text/plain", task._id);
                            }}
                            onDragEnd={() => {
                              dragged.current = null;
                            }}
                            onDragOver={(event) => {
                              if (!writer.disabled && complete && displayFilters.order === "sortOrder") {
                                event.preventDefault();
                                event.stopPropagation();
                              }
                            }}
                            onDrop={(event) => {
                              if (writer.disabled || displayFilters.order !== "sortOrder") return;
                              event.preventDefault();
                              event.stopPropagation();
                              const captured = dragged.current;
                              if (!captured || captured.task._id === task._id) return;
                              const neighbors = subgroup.tasks.filter((value) => value._id !== captured.task._id);
                              const nextIndex = neighbors.indexOf(task);
                              drop(group.id, subgroup.id, {
                                previous: taskNeighbor(neighbors[nextIndex - 1]),
                                next: taskNeighbor(task),
                              });
                            }}
                          >
                            {row}
                            {displayFilters.order === "sortOrder" && (
                              <TaskPositionControls
                                tasks={subgroup.tasks}
                                index={index}
                                disabled={writer.disabled || !complete}
                                save={(change) => save(task, change)}
                              />
                            )}
                          </div>
                        ))}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
function TaskPositionControls({
  tasks,
  index,
  disabled,
  save,
}: {
  tasks: Tasks;
  index: number;
  disabled: boolean;
  save: (change: Omit<FunctionArgs<typeof api.tasks.index.update>, "taskId" | "expectedUpdatedAt">) => Promise<void>;
}) {
  return (
    <CustomMenu ellipsis placement="bottom-end" closeOnSelect disabled={disabled} aria-label="Reorder work item">
      <CustomMenu.MenuItem
        disabled={index === 0}
        onClick={() =>
          void save({ position: { previous: taskNeighbor(tasks[index - 2]), next: taskNeighbor(tasks[index - 1]) } })
        }
      >
        Move up
      </CustomMenu.MenuItem>
      <CustomMenu.MenuItem
        disabled={index === tasks.length - 1}
        onClick={() =>
          void save({ position: { previous: taskNeighbor(tasks[index + 1]), next: taskNeighbor(tasks[index + 2]) } })
        }
      >
        Move down
      </CustomMenu.MenuItem>
    </CustomMenu>
  );
}
function taskNeighbor(task: Tasks[number] | undefined) {
  return task ? { taskId: task._id, expectedUpdatedAt: task.updatedAt } : null;
}
export function NativeSavedViewTask({
  task,
  address,
  displayProperties,
  kanban = false,
  disabled = false,
  renderContent,
}: {
  task: Tasks[number];
  address: Address;
  displayProperties: Properties;
  kanban?: boolean;
  disabled?: boolean;
  renderContent?: (row: ReactNode, writer: ReturnType<typeof useTaskPropertyWriter>) => ReactNode;
}) {
  const lifecycle = useTaskLifecycle(() => {});
  const writer = useTaskPropertyWriter(task, lifecycle.pending, disabled);
  const cardRef = useRef<HTMLDivElement>(null);
  const identifier = `${address.project.identifier}-${task.sequence}`;
  const href = `/${address.workspace.slug}/browse/${identifier}/`;
  return (
    <TaskLifecycle
      task={task}
      href={href}
      disabled={disabled || writer.pending}
      lifecycle={lifecycle}
      row={(actions) => {
        const row = (
          <NativeTaskRow
            task={task}
            identifier={identifier}
            identifierWidth={calculateIdentifierWidth(address.project.identifier.length, address.project.nextSequence)}
            href={href}
            pending={writer.pending}
            showIdentifier={displayProperties.key}
            actions={actions}
            kanban={
              kanban
                ? {
                    cardRef,
                    isDragging: false,
                    isDraggingOver: false,
                    canDrag: false,
                    disabled: writer.disabled,
                  }
                : undefined
            }
            properties={<TaskRowPropertyControls task={task} display={displayProperties} writer={writer} />}
          />
        );
        return renderContent ? renderContent(row, writer) : row;
      }}
    />
  );
}
function NativeSpreadsheet({
  tasks,
  address,
  displayProperties,
  disabled,
}: {
  tasks: Tasks;
  address: Address;
  displayProperties: Properties;
  disabled: boolean;
}) {
  const columns = taskDisplayPropertiesSchema
    .keyof()
    .options.filter((key) => displayProperties[key] && key !== "key" && key !== "issue_type");
  const only = (key: (typeof columns)[number]) => {
    const display = { ...displayProperties };
    for (const property of taskDisplayPropertiesSchema.keyof().options) display[property] = property === key;
    return display;
  };
  const gridTemplateColumns = `minmax(20rem, 1fr) repeat(${columns.length}, minmax(9rem, 1fr))`;
  return (
    <div className="overflow-auto">
      <div role="table" aria-label="View work items" className="min-w-max">
        <div className="contents">
          <div
            role="row"
            className="grid border-b border-subtle text-left text-12 font-medium"
            style={{ gridTemplateColumns }}
          >
            <div role="columnheader" className="sticky left-0 bg-surface-1 p-3">
              Work item
            </div>
            {columns.map((key) => (
              <div role="columnheader" key={key} className="border-l border-subtle px-3 py-2">
                {key.replaceAll("_", " ")}
              </div>
            ))}
          </div>
        </div>
        <div className="contents">
          {tasks.map((task) => (
            <NativeSavedViewTask
              key={task._id}
              task={task}
              address={address}
              displayProperties={only("key")}
              disabled={disabled}
              renderContent={(row, writer) => (
                <div role="row" className="grid border-b border-subtle" style={{ gridTemplateColumns }}>
                  <div role="cell" className="sticky left-0 bg-surface-1">
                    {row}
                  </div>
                  {columns.map((key) => (
                    <div role="cell" key={key} className="border-l border-subtle p-2">
                      <TaskRowPropertyControls task={task} display={only(key)} writer={writer} />
                    </div>
                  ))}
                </div>
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
