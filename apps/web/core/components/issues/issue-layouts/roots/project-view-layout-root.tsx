import { useRef, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { SPREADSHEET_PROPERTY_DETAILS } from "@plane/constants";
import { priority as taskPriority, taskDisplayPropertiesSchema } from "@summon/convex/task-schema";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { CustomMenu } from "@plane/ui";
import { TaskLifecycle, NativeTaskRow, useTaskLifecycle } from "@/components/convex-core/tasks/lifecycle";
import { TaskRowPropertyControls, useTaskPropertyWriter } from "@/components/convex-core/tasks/task-properties";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { usePendingConfirmation } from "@/hooks/use-reload-confirmation";
import { calculateIdentifierWidth } from "../utils";
import { NativeCalendar } from "../calendar/roots/project-view-root";
import { NativeTimeline } from "../gantt/blocks";

type Tasks = FunctionReturnType<typeof api.savedViews.results.list>["page"];
type Address = FunctionReturnType<typeof api.navigation.address.resolveProjectId>;
type WorkspaceRows = FunctionReturnType<typeof api.savedViews.workspace.results>["page"];
type GroupCatalogs = ReturnType<typeof useGroupCatalogs> | ReturnType<typeof useWorkspaceGroupCatalogs>;
type TaskIdentity = Pick<ComponentProps<typeof NativeTaskRow>, "identifier" | "href" | "identifierWidth">;
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
  const groups = new Set(
    display.layout === "list" || display.layout === "kanban" ? [display.groupBy, display.subGroupBy] : []
  );
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
function groupOptions(kind: Display["groupBy"], catalogs: GroupCatalogs): { id: string; name: string | null }[] {
  switch (kind) {
    case "stateId":
      return (catalogs.states ?? []).map((row) =>
        "project" in row
          ? { id: row.id, name: `${row.project.identifier} · ${row.name}` }
          : { id: row._id, name: row.name }
      );
    case "priority":
      return taskPriority.members.map(({ value }) => ({ id: value, name: value }));
    case "cycleId":
      return catalogs.cycles.map((row) =>
        "cycle" in row
          ? { id: row.cycle._id, name: `${row.project.identifier} · ${row.cycle.name}` }
          : { id: row._id, name: row.name }
      );
    case "moduleId":
      return catalogs.modules.map((row) =>
        "module" in row
          ? { id: row.module._id, name: `${row.project.identifier} · ${row.module.name}` }
          : { id: row._id, name: row.name }
      );
    case "labelId":
      return (catalogs.labels ?? []).map((row) =>
        "project" in row
          ? { id: row.id, name: `${row.project.identifier} · ${row.name}` }
          : { id: row._id, name: row.name }
      );
    case "assigneeId":
    case "createdBy": {
      const people = catalogs.people;
      if (!people) return [];
      return "members" in people
        ? people.members.map((row) => ({ id: row.userId, name: row.displayName }))
        : people.map((row) => ({ id: row.id, name: row.name }));
    }
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
function grouped(tasks: Tasks, kind: Display["groupBy"], options: ReturnType<typeof groupOptions>, showEmpty: boolean) {
  if (kind === null) return [{ id: "", name: "Work items", tasks }];
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
function moveGroupMembership<T extends string>(previous: T[], sourceId: string, target: T | undefined): T[] {
  const retained = previous.filter((id) => id !== sourceId);
  return target ? [...new Set([...retained, target])] : retained;
}
function groupChange(
  task: Tasks[number],
  kind: Display["groupBy"],
  id: string,
  catalogs: GroupCatalogs,
  sourceId: string
): Omit<FunctionArgs<typeof api.tasks.index.update>, "taskId" | "expectedUpdatedAt"> {
  switch (kind) {
    case "stateId": {
      const state = catalogs.states?.find((row) => ("id" in row ? row.id : row._id) === id);
      return { stateId: state ? ("id" in state ? state.id : state._id) : null };
    }
    case "priority": {
      const priority = taskPriority.members.find(({ value }) => value === id)?.value;
      return priority ? { priority } : {};
    }
    case "assigneeId": {
      const people = catalogs.people;
      const userId =
        people &&
        ("members" in people
          ? people.members.find((row) => row.userId === id)?.userId
          : people.find((row) => row.id === id)?.id);
      return {
        assigneeIds: moveGroupMembership(task.assigneeIds, sourceId, userId),
      };
    }
    case "labelId": {
      const label = catalogs.labels?.find((row) => ("id" in row ? row.id : row._id) === id);
      const labelId = label && ("id" in label ? label.id : label._id);
      return {
        labelIds: moveGroupMembership(task.labelIds, sourceId, labelId),
      };
    }
    case "cycleId":
    case "moduleId":
      return relationshipGroupChange(task, kind, id, catalogs, sourceId);
    default:
      return {};
  }
}
function relationshipGroupChange(
  task: Tasks[number],
  kind: "cycleId" | "moduleId",
  id: string,
  catalogs: GroupCatalogs,
  sourceId: string
): Pick<FunctionArgs<typeof api.tasks.index.update>, "cycle" | "modules"> {
  switch (kind) {
    case "cycleId": {
      const row = catalogs.cycles.find((value) => ("cycle" in value ? value.cycle._id : value._id) === id);
      const cycle = row && ("cycle" in row ? row.cycle : row);
      return {
        cycle: {
          previous: task.cycleReference,
          next: cycle ? { cycleId: cycle._id, expectedCycleUpdatedAt: cycle.updatedAt } : null,
        },
      };
    }
    case "moduleId": {
      const row = catalogs.modules.find((value) => ("module" in value ? value.module._id : value._id) === id);
      const module = row && ("module" in row ? row.module : row);
      return {
        modules: {
          previous: task.moduleReferences,
          next: [
            ...task.moduleReferences.filter((value) => value.moduleId !== sourceId && value.moduleId !== module?._id),
            ...(module ? [{ moduleId: module._id, expectedModuleUpdatedAt: module.updatedAt }] : []),
          ],
        },
      };
    }
  }
}
function groupProject(kind: Display["groupBy"], id: string, catalogs: GroupCatalogs) {
  switch (kind) {
    case "stateId": {
      const row = catalogs.states?.find((value) => ("id" in value ? value.id : value._id) === id);
      return row && ("project" in row ? row.project.id : row.projectId);
    }
    case "labelId": {
      const row = catalogs.labels?.find((value) => ("id" in value ? value.id : value._id) === id);
      return row && ("project" in row ? row.project.id : row.projectId);
    }
    case "cycleId": {
      const row = catalogs.cycles.find((value) => ("cycle" in value ? value.cycle._id : value._id) === id);
      return row && ("cycle" in row ? row.project.id : row.projectId);
    }
    case "moduleId": {
      const row = catalogs.modules.find((value) => ("module" in value ? value.module._id : value._id) === id);
      return row && ("module" in row ? row.project.id : row.projectId);
    }
    default:
      return null;
  }
}
export function ProjectViewLayoutRoot({
  tasks,
  address,
  displayFilters,
  displayProperties,
  cohortComplete,
  taskActions,
}: {
  tasks: Tasks;
  address: Address;
  displayFilters: Display;
  displayProperties: Properties;
  cohortComplete: boolean;
  taskActions?: (task: Tasks[number]) => ComponentProps<typeof TaskLifecycle>["children"];
}) {
  const catalogs = useGroupCatalogs(address.project._id, displayFilters);
  return (
    <NativeTaskLayout
      tasks={tasks}
      displayFilters={displayFilters}
      displayProperties={displayProperties}
      cohortComplete={cohortComplete}
      catalogs={catalogs}
      taskActions={taskActions}
      identifyTask={(task) => {
        const identifier = `${address.project.identifier}-${task.sequence}`;
        return {
          identifier,
          href: `/${address.workspace.slug}/browse/${identifier}/`,
          identifierWidth: calculateIdentifierWidth(address.project.identifier.length, address.project.nextSequence),
        };
      }}
    />
  );
}
function useWorkspaceGroupCatalogs(workspaceId: Address["workspace"]["_id"], display: Display) {
  const groups = new Set(
    display.layout === "list" || display.layout === "kanban" ? [display.groupBy, display.subGroupBy] : []
  );
  const states = usePaginatedQuery(
    api.savedViews.workspaceChoices.states,
    groups.has("stateId") ? { workspaceId } : "skip",
    { initialNumItems: 100 }
  );
  const labels = usePaginatedQuery(
    api.savedViews.workspaceChoices.labels,
    groups.has("labelId") ? { workspaceId } : "skip",
    { initialNumItems: 100 }
  );
  const needsPeople = groups.has("assigneeId") || groups.has("createdBy");
  const people = usePaginatedQuery(api.savedViews.workspaceChoices.people, needsPeople ? { workspaceId } : "skip", {
    initialNumItems: 100,
  });
  const cycles = usePaginatedQuery(api.cycles.workspace.list, groups.has("cycleId") ? { workspaceId } : "skip", {
    initialNumItems: 100,
  });
  const modules = usePaginatedQuery(api.modules.workspace.list, groups.has("moduleId") ? { workspaceId } : "skip", {
    initialNumItems: 100,
  });
  const required = [
    ...(groups.has("stateId") ? [states] : []),
    ...(groups.has("labelId") ? [labels] : []),
    ...(needsPeople ? [people] : []),
    ...(groups.has("cycleId") ? [cycles] : []),
    ...(groups.has("moduleId") ? [modules] : []),
  ];
  return {
    states: states.results,
    labels: labels.results,
    people: people.results,
    cycles: cycles.results,
    modules: modules.results,
    complete: required.every((rows) => rows.status === "Exhausted"),
    canLoadMore: required.some((rows) => rows.status === "CanLoadMore"),
    loadMore: () =>
      required.forEach((rows) => {
        if (rows.status === "CanLoadMore") rows.loadMore(100);
      }),
  };
}
export function WorkspaceViewLayoutRoot({
  rows,
  workspace,
  displayFilters,
  displayProperties,
  cohortComplete,
}: {
  rows: WorkspaceRows;
  workspace: Pick<Address["workspace"], "_id" | "slug">;
  displayFilters: Display;
  displayProperties: Properties;
  cohortComplete: boolean;
}) {
  const catalogs = useWorkspaceGroupCatalogs(workspace._id, displayFilters);
  return (
    <NativeTaskLayout
      tasks={rows.map((row) => row.task)}
      displayFilters={displayFilters}
      displayProperties={displayProperties}
      cohortComplete={cohortComplete}
      catalogs={catalogs}
      identifyTask={(task) => {
        const row = rows.find((value) => value.task._id === task._id);
        if (!row) throw new Error("Workspace result project is unavailable.");
        const identifier = `${row.project.identifier}-${task.sequence}`;
        return {
          identifier,
          href: `/${workspace.slug}/browse/${identifier}/`,
          identifierWidth: calculateIdentifierWidth(row.project.identifier.length, task.sequence),
        };
      }}
    />
  );
}
function NativeTaskLayout({
  tasks,
  displayFilters,
  displayProperties,
  cohortComplete,
  taskActions,
  catalogs,
  identifyTask,
}: {
  tasks: Tasks;
  displayFilters: Display;
  displayProperties: Properties;
  cohortComplete: boolean;
  taskActions?: (task: Tasks[number]) => ComponentProps<typeof TaskLifecycle>["children"];
  catalogs: GroupCatalogs;
  identifyTask: (task: Tasks[number]) => TaskIdentity;
}) {
  const update = useMutation(api.tasks.index.update);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const dragged = useRef<{ task: Tasks[number]; groupId: string; subgroupId: string } | null>(null);
  const beginPending = usePendingConfirmation("Work item changes are still saving.");
  const save = async (
    task: Tasks[number],
    change: Omit<FunctionArgs<typeof api.tasks.index.update>, "taskId" | "expectedUpdatedAt">
  ) => {
    if (pending || !task.canEdit) return;
    const release = beginPending();
    setPending(true);
    setError("");
    try {
      await update({ taskId: task._id, expectedUpdatedAt: task.updatedAt, ...change });
    } catch (failure) {
      const message = mutationMessage(failure);
      setError(message);
      setToast({ type: TOAST_TYPE.ERROR, title: "Could not save work item changes", message });
    } finally {
      setPending(false);
      release();
    }
  };
  const canMoveGroup = (task: Tasks[number], kind: Display["groupBy"], id: string) => {
    const projectId = id ? groupProject(kind, id, catalogs) : null;
    return projectId === null || projectId === task.projectId;
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
        if (!canMoveGroup(captured.task, kind, id)) throw new Error("Choose a group in this work item’s project.");
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
  const canDrop = (groupId: string, subgroupId: string) => {
    const captured = dragged.current;
    return (
      !!captured &&
      cohortComplete &&
      catalogs.complete &&
      !pending &&
      canMoveGroup(captured.task, displayFilters.groupBy, groupId) &&
      canMoveGroup(captured.task, displayFilters.subGroupBy, subgroupId) &&
      (displayFilters.groupBy !== "createdBy" || groupId === captured.groupId) &&
      (displayFilters.subGroupBy !== "createdBy" || subgroupId === captured.subgroupId)
    );
  };
  const renderTask = (
    task: Tasks[number],
    kanban = false,
    renderContent?: (row: ReactNode, writer: ReturnType<typeof useTaskPropertyWriter>) => ReactNode
  ) => (
    <NativeSavedViewTask
      task={task}
      {...identifyTask(task)}
      displayProperties={displayProperties}
      kanban={kanban}
      disabled={pending}
      renderContent={renderContent}
    >
      {taskActions?.(task)}
    </NativeSavedViewTask>
  );
  const dateProps = { tasks, displayFilters, displayProperties, cohortComplete, renderTask };
  if (displayFilters.layout === "calendar") return <NativeCalendar {...dateProps} />;
  if (displayFilters.layout === "gantt_chart")
    return (
      <NativeTimeline
        {...dateProps}
        taskLink={(task) => {
          const identity = identifyTask(task);
          return [identity.identifier, identity.href];
        }}
      />
    );
  if (displayFilters.layout === "spreadsheet")
    return (
      <NativeSpreadsheet
        tasks={tasks}
        identifyTask={identifyTask}
        displayProperties={displayProperties}
        disabled={pending}
        taskActions={taskActions}
      />
    );
  const complete = cohortComplete && catalogs.complete;
  const groups = grouped(
    tasks,
    displayFilters.groupBy,
    groupOptions(displayFilters.groupBy, catalogs),
    displayFilters.showEmptyGroups
  );
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
              if (canDrop(group.id, dragged.current?.subgroupId ?? "")) event.preventDefault();
              else event.dataTransfer.dropEffect = "none";
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
            {grouped(
              group.tasks,
              displayFilters.subGroupBy,
              groupOptions(displayFilters.subGroupBy, catalogs),
              displayFilters.showEmptyGroups
            ).map((subgroup) => (
              <div
                key={subgroup.id}
                onDragOver={(event) => {
                  if (canDrop(group.id, subgroup.id)) event.preventDefault();
                  else event.dataTransfer.dropEffect = "none";
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
                            if (
                              !writer.disabled &&
                              canDrop(group.id, subgroup.id) &&
                              displayFilters.order === "sortOrder"
                            ) {
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
            ))}
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
  identifier,
  href,
  identifierWidth,
  displayProperties,
  kanban = false,
  disabled = false,
  renderContent,
  children,
}: {
  task: Tasks[number];
  identifier: TaskIdentity["identifier"];
  href: TaskIdentity["href"];
  identifierWidth: TaskIdentity["identifierWidth"];
  displayProperties: Properties;
  kanban?: boolean;
  disabled?: boolean;
  renderContent?: (row: ReactNode, writer: ReturnType<typeof useTaskPropertyWriter>) => ReactNode;
  children?: ComponentProps<typeof TaskLifecycle>["children"];
}) {
  const lifecycle = useTaskLifecycle(() => {});
  const writer = useTaskPropertyWriter(task, lifecycle.pending, disabled);
  const cardRef = useRef<HTMLDivElement>(null);
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
            identifierWidth={identifierWidth}
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
    >
      {children}
    </TaskLifecycle>
  );
}
function NativeSpreadsheet({
  tasks,
  identifyTask,
  displayProperties,
  disabled,
  taskActions,
}: {
  tasks: Tasks;
  identifyTask: (task: Tasks[number]) => TaskIdentity;
  displayProperties: Properties;
  disabled: boolean;
  taskActions?: (task: Tasks[number]) => ComponentProps<typeof TaskLifecycle>["children"];
}) {
  const { t } = useTranslation();
  const columns = taskDisplayPropertiesSchema.keyof().options.flatMap((key) => {
    if (!displayProperties[key] || key === "key" || key === "issue_type") return [];
    const property = SPREADSHEET_PROPERTY_DETAILS[key];
    return property ? [{ key, property }] : [];
  });
  const only = (key: keyof Properties) => {
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
            {columns.map(({ key, property }) => (
              <div role="columnheader" key={key} className="border-l border-subtle px-3 py-2">
                {t(property.i18n_title)}
              </div>
            ))}
          </div>
        </div>
        <div className="contents">
          {tasks.map((task) => (
            <NativeSavedViewTask
              key={task._id}
              task={task}
              {...identifyTask(task)}
              displayProperties={only("key")}
              disabled={disabled}
              renderContent={(row, writer) => (
                <div role="row" className="grid border-b border-subtle" style={{ gridTemplateColumns }}>
                  <div role="cell" className="sticky left-0 bg-surface-1">
                    {row}
                  </div>
                  {columns.map(({ key }) => (
                    <div role="cell" key={key} className="border-l border-subtle p-2">
                      <TaskRowPropertyControls task={task} display={only(key)} writer={writer} />
                    </div>
                  ))}
                </div>
              )}
            >
              {taskActions?.(task)}
            </NativeSavedViewTask>
          ))}
        </div>
      </div>
    </div>
  );
}
