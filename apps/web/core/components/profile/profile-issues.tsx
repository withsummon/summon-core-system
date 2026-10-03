/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import { useMutation, useQuery } from "convex/react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { useNavigate, useOutletContext, useSearchParams } from "react-router";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { priority } from "@summon/convex/task-schema";
import { Button } from "@plane/propel/button";
import { PriorityIcon, ChevronRightIcon, PlusIcon } from "@plane/propel/icons";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import { Dialog } from "@plane/propel/dialog";
import { DropIndicator, ModalCore } from "@plane/ui";
import { cn } from "@plane/utils";
import { IssueListBlockView } from "@/components/issues/issue-layouts/list/block";
import { KanbanIssueBlockView } from "@/components/issues/issue-layouts/kanban/block";
import { IdentifierText } from "@/components/issues/issue-detail/identifier-text";
import { calculateIdentifierWidth } from "@/components/issues/issue-layouts/utils";
import { ListLayoutLoader } from "@/components/ui/loader/layouts/list-layout-loader";
import { FiltersRow } from "@/components/rich-filters/filters-row";
import { TaskLifecycle, useTaskLifecycle } from "@/components/convex-core/tasks/lifecycle";
import { statusOptions } from "@/components/convex-core/tasks/options";
import { TaskRowProperties } from "@/components/convex-core/tasks/task-properties";
import { CreateProjectIssue, TaskPeek } from "@/components/convex-core/tasks/task-detail";
import { ProjectChoice } from "@/components/convex-core/tasks/task-structure";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { usePlatformOS } from "@/hooks/use-platform-os";
import type { ProfileSession } from "@/app/(all)/[workspaceSlug]/(projects)/profile/[userId]/layout";
import { ProfileFiltersFailure, ProfileIssuesFilter } from "./profile-issues-filter";

type ProfileListArgs = FunctionArgs<typeof api.tasks.profile.list>;
type ProfileRow = FunctionReturnType<typeof api.tasks.profile.list>["page"][number];

export function ProfileIssuesPage({ type }: { type: ProfileListArgs["view"] }) {
  const session = useOutletContext<ProfileSession>();
  const { taskControls } = session;
  const [creation, setCreation] = useState<{
    projectId: FunctionArgs<typeof api.tasks.states.list>["projectId"] | null;
    initialValues: ComponentProps<typeof CreateProjectIssue>["initialValues"];
  } | null>(null);
  const closeCreate = useCallback(() => setCreation(null), []);
  const projects = useQuery(
    api.projects.index.list,
    type === "subscribed" ? "skip" : { workspaceId: session.workspace._id }
  );
  const writableProjects = projects?.filter(
    (project) => project.membershipRole !== "guest" && project.workspaceRole !== "guest"
  );
  const address = useQuery(
    api.navigation.address.resolveProjectId,
    creation?.projectId ? { workspaceId: session.workspace._id, projectId: creation.projectId } : "skip"
  );
  const states = useQuery(api.tasks.states.list, address ? { projectId: address.project._id } : "skip");
  return (
    <div className="flex size-full min-h-0 flex-col">
      <div className="flex justify-end border-b border-subtle p-2 md:hidden">
        <ProfileIssuesFilter controls={taskControls} />
      </div>
      <FiltersRow filter={taskControls.filter} disabledAllOperations={taskControls.pending} />
      <ProfileFiltersFailure controls={taskControls} />
      {taskControls.preferences ? (
        <ProfileTaskGroups
          key={type}
          type={type}
          session={session}
          writableProjects={writableProjects}
          onCreate={(projectId, initialValues) => setCreation({ projectId, initialValues })}
        />
      ) : (
        <ListLayoutLoader />
      )}
      <TaskPeek workspaceSlug={session.workspace.slug} />
      {creation && (!address || !states) && (
        <ModalCore isOpen handleClose={closeCreate}>
          <div className="space-y-4 rounded-lg bg-surface-1 p-5">
            <Dialog.Title className="text-h4-medium">Create work item</Dialog.Title>
            <ProjectChoice
              workspaceId={session.workspace._id}
              value={creation.projectId}
              label="Project"
              onChange={(projectId) => setCreation({ ...creation, projectId })}
            />
            <Button variant="secondary" onClick={closeCreate}>
              Cancel
            </Button>
          </div>
        </ModalCore>
      )}
      {creation && address && states && (
        <CreateProjectIssue
          key={address.project._id}
          address={address}
          states={states}
          onClose={closeCreate}
          initialValues={creation.initialValues}
          canCreate={writableProjects?.some((project) => project._id === address.project._id) === true}
        />
      )}
    </div>
  );
}

function useProfileTaskDrag(
  rows: ProfileRow[],
  display: ProfileSession["taskControls"]["preferences"],
  complete: boolean
) {
  const update = useMutation(api.tasks.index.update);
  const active = useRef<{ row: ProfileRow; group: ProfileListArgs["group"]; onDelete: () => void } | null>(null);
  const [dragged, setDragged] = useState<ProfileRow["task"]["_id"] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const deleteRef = useRef<HTMLDivElement>(null);
  const enabled =
    complete &&
    display?.displayFilters.layout === "kanban" &&
    (display.displayFilters.groupBy === "priority" || display.displayFilters.groupBy === "labelId");
  useReloadConfirmations(pending, "The work item move is still saving.", undefined, pending);
  useEffect(
    () =>
      monitorForElements({
        onDrop: () => {
          active.current = null;
          setDragged(null);
        },
      }),
    []
  );
  useEffect(() => {
    const element = deleteRef.current;
    if (!element || !dragged) return;
    return dropTargetForElements({
      element,
      canDrop: ({ source }) =>
        source.data.taskId === active.current?.row.task._id && !!active.current?.row.task.canDelete,
      onDrop: ({ source }) => {
        if (source.data.taskId !== active.current?.row.task._id) return;
        if (!source.element.isConnected)
          setError("The work item changed while dragging. Drop it again after the list updates.");
        else active.current?.onDelete();
      },
    });
  }, [dragged]);
  return {
    enabled: enabled && !pending,
    pending,
    error,
    dragged,
    deleteRef,
    canDelete: !!active.current?.row.task.canDelete,
    start(row: ProfileRow, group: ProfileListArgs["group"], onDelete: () => void) {
      active.current = { row, group, onDelete };
      setDragged(row.task._id);
      setError("");
    },
    canDrop(taskId: unknown) {
      return enabled && !pending && active.current !== null && taskId === active.current.row.task._id;
    },
    async move(group: ProfileListArgs["group"], target: ProfileRow | undefined, after: boolean) {
      const source = active.current;
      if (!source || pending || !display || (group?.by !== "priority" && group?.by !== "labelId")) return;
      const destination = rows.filter(
        ({ task }) => task._id !== source.row.task._id && matchesProfileGroup(task, group)
      );
      const targetIndex = target ? destination.findIndex(({ task }) => task._id === target.task._id) : null;
      if (targetIndex === -1) {
        setError("The destination changed while dragging. Drop the work item again after the list updates.");
        return;
      }
      const index =
        targetIndex !== null
          ? targetIndex + Number(after)
          : display.displayFilters.order === "sortOrder"
            ? destination.length
            : 0;
      const previous = destination[index - 1]?.task;
      const next = destination[index]?.task;
      const change: FunctionArgs<typeof api.tasks.index.update> = {
        taskId: source.row.task._id,
        expectedUpdatedAt: source.row.task.updatedAt,
        position: {
          previous: previous ? { taskId: previous._id, expectedUpdatedAt: previous.updatedAt } : null,
          next: next ? { taskId: next._id, expectedUpdatedAt: next.updatedAt } : null,
        },
      };
      if (group.by === "priority") change.priority = group.value;
      else {
        const retained = source.row.task.labelIds.filter(
          (id) => source.group?.by !== "labelId" || id !== source.group.value
        );
        change.labelIds =
          group.value === null ? [] : retained.includes(group.value) ? retained : [...retained, group.value];
      }
      setPending(true);
      setError("");
      try {
        await update(change);
      } catch (failure) {
        setError(mutationMessage(failure));
      } finally {
        setPending(false);
      }
    },
  };
}

function ProfileTaskGroups({
  type,
  session,
  writableProjects,
  onCreate,
}: {
  type: ProfileListArgs["view"];
  session: ProfileSession;
  writableProjects: FunctionReturnType<typeof api.projects.index.list> | undefined;
  onCreate: (
    projectId: FunctionArgs<typeof api.tasks.states.list>["projectId"] | null,
    initialValues: ComponentProps<typeof CreateProjectIssue>["initialValues"]
  ) => void;
}) {
  const { workspace, subject, taskControls, summary } = session;
  const preferences = taskControls.preferences;
  const rows = usePaginatedQuery(
    api.tasks.profile.list,
    preferences
      ? {
          workspaceId: workspace._id,
          userId: subject.userId,
          view: type,
          order: preferences.displayFilters.order,
          filters: preferences.filters,
          includeSubtasks: preferences.displayFilters.includeSubtasks,
          group: null,
          subgroup: null,
        }
      : "skip",
    { initialNumItems: 100 }
  );
  const { status, loadMore } = rows;
  useEffect(() => {
    if (status === "CanLoadMore") loadMore(100);
  }, [status, loadMore]);
  const drag = useProfileTaskDrag(rows.results, preferences, status === "Exhausted");
  if (!preferences) return null;
  const { displayFilters, displayProperties } = preferences;
  const complete = status === "Exhausted";
  const groups = profileGroupCatalog(session, displayFilters.groupBy);
  const ready = complete && summary.status === "Exhausted" && taskControls.labels.status === "Exhausted";
  return (
    <div
      className={cn(
        "relative min-h-0 flex-1 overflow-auto px-3 py-3",
        displayFilters.layout === "kanban" && "flex gap-3"
      )}
      aria-label="Profile work items"
      aria-busy={!ready}
    >
      {drag.dragged && drag.canDelete && (
        <div
          ref={drag.deleteRef}
          className="fixed top-3 left-1/2 z-40 -translate-x-1/2 rounded-sm border-2 border-danger-strong/20 bg-surface-1 px-3 py-5 text-11 font-medium text-danger-primary"
        >
          Drop here to delete the work item.
        </div>
      )}
      {drag.error && (
        <p role="alert" className="text-13 text-danger-primary">
          {drag.error}
        </p>
      )}
      {!complete && (
        <span role="status" className="sr-only">
          Loading authorized work items…
        </span>
      )}
      {ready && rows.results.length === 0 && (
        <EmptyStateCompact assetKey="work-item" title="No matching work items" assetClassName="size-20" />
      )}
      {groups.map(({ group, title, projectId }) => {
        const tasks = rows.results.filter(({ task }) => matchesProfileGroup(task, group));
        return (
          <ProfileTaskGroup
            key={JSON.stringify(group)}
            group={group}
            drag={drag}
            title={title}
            rows={tasks}
            complete={ready}
            display={displayFilters}
            properties={displayProperties}
            workspaceSlug={workspace.slug}
            onCreate={
              writableProjects?.some((project) => projectId === null || project._id === projectId)
                ? () => {
                    switch (group?.by) {
                      case "status":
                        onCreate(projectId, { status: group.value });
                        break;
                      case "priority":
                        onCreate(projectId, { properties: { priority: group.value } });
                        break;
                      case "labelId":
                        onCreate(projectId, { properties: { labelIds: group.value === null ? [] : [group.value] } });
                        break;
                      case "projectId":
                      case undefined:
                        onCreate(projectId, {});
                        break;
                      default:
                        group satisfies never;
                    }
                  }
                : undefined
            }
          />
        );
      })}
    </div>
  );
}

function profileGroupCatalog(
  session: ProfileSession,
  selected: NonNullable<ProfileSession["taskControls"]["preferences"]>["displayFilters"]["groupBy"]
) {
  switch (selected) {
    case null:
      return [{ group: null, title: "All work items", projectId: null }];
    case "status":
      return statusOptions.map((item) => ({
        group: { by: selected, value: item.value },
        title: item.label,
        projectId: null,
      }));
    case "priority":
      return priority.members.map((item) => ({
        group: { by: selected, value: item.value },
        title: item.value === "none" ? "No priority" : item.value.charAt(0).toUpperCase() + item.value.slice(1),
        projectId: null,
      }));
    case "projectId":
      return session.summary.results.map((project) => ({
        group: { by: selected, value: project.projectId },
        title: project.name,
        projectId: project.projectId,
      }));
    case "labelId":
      return [
        { group: { by: selected, value: null }, title: "No labels", projectId: null },
        ...session.taskControls.labels.results.map((label) => ({
          group: { by: selected, value: label.id },
          title: label.name,
          projectId: label.project.id,
        })),
      ];
  }
}

function matchesProfileGroup(task: ProfileRow["task"], group: ProfileListArgs["group"]) {
  if (group === null) return true;
  if (group.by === "labelId")
    return group.value === null ? task.labelIds.length === 0 : task.labelIds.includes(group.value);
  return task[group.by] === group.value;
}

function ProfileTaskGroup({
  group,
  drag,
  title,
  rows,
  complete,
  display,
  properties,
  workspaceSlug,
  onCreate,
}: {
  group: ProfileListArgs["group"];
  drag: ReturnType<typeof useProfileTaskDrag>;
  title: string;
  rows: ProfileRow[];
  complete: boolean;
  display: NonNullable<ProfileSession["taskControls"]["preferences"]>["displayFilters"];
  properties: NonNullable<ProfileSession["taskControls"]["preferences"]>["displayProperties"];
  workspaceSlug: string;
  onCreate?: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [visible, setVisible] = useState(50);
  const board = display.layout === "kanban";
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !drag.enabled) return;
    return dropTargetForElements({
      element,
      canDrop: ({ source }) => drag.canDrop(source.data.taskId),
      onDrop: ({ source, location }) => {
        if (location.current.dropTargets[0]?.element === element && drag.canDrop(source.data.taskId))
          void drag.move(group, undefined, false);
      },
    });
  }, [drag, group]);
  if (complete && !display.showEmptyGroups && rows.length === 0) return null;
  return (
    <section
      ref={ref}
      className={cn("relative mb-4 min-w-0", board && "flex w-72 shrink-0 flex-col")}
      aria-label={title}
    >
      <header className="group/list-header flex items-center gap-2 py-1.5">
        <Button
          variant="ghost"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="min-w-0 flex-1 justify-start gap-2 px-0 text-left"
        >
          {group && <ChevronRightIcon className={cn("size-3.5 shrink-0", expanded && "rotate-90")} />}
          {group?.by === "priority" && <PriorityIcon priority={group.value} className="size-3.5" />}
          <span className="truncate font-medium text-primary">{title}</span>
          {complete ? (
            <span className="text-xs text-secondary tabular-nums">{rows.length}</span>
          ) : (
            <span role="status" className="text-xs text-placeholder">
              …
            </span>
          )}
        </Button>
        {onCreate && (
          <Button
            variant="ghost"
            aria-label={`Add work item to ${title}`}
            className="grid size-7 shrink-0 place-items-center p-0"
            onClick={onCreate}
          >
            <PlusIcon width={14} strokeWidth={2} />
          </Button>
        )}
      </header>
      {expanded && (
        <>
          {rows.slice(0, visible).map((row) => (
            <ProfileTaskRow
              key={row.task._id}
              row={row}
              group={group}
              drag={drag}
              manual={display.order === "sortOrder"}
              board={board}
              properties={properties}
              workspaceSlug={workspaceSlug}
            />
          ))}
          {rows.length > visible && (
            <Button variant="ghost" onClick={() => setVisible((count) => count + 50)} className="my-2 w-full">
              Load more work items
            </Button>
          )}
        </>
      )}
    </section>
  );
}

function ProfileTaskRow({
  row,
  group,
  drag,
  manual,
  board,
  properties,
  workspaceSlug,
}: {
  row: ProfileRow;
  group: ProfileListArgs["group"];
  drag: ReturnType<typeof useProfileTaskDrag>;
  manual: boolean;
  board: boolean;
  workspaceSlug: string;
  properties: NonNullable<ProfileSession["taskControls"]["preferences"]>["displayProperties"];
}) {
  const { task } = row;
  const rowRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { isMobile } = usePlatformOS();
  const lifecycle = useTaskLifecycle(() => {});
  const [over, setOver] = useState<"before" | "after" | null>(null);
  useEffect(() => {
    const element = cardRef.current;
    if (!element || !board || !drag.enabled) return;
    return combine(
      draggable({
        element,
        canDrag: () => task.canEdit && !lifecycle.pending,
        getInitialData: () => ({ taskId: task._id }),
        onDragStart: () => drag.start(row, group, () => lifecycle.choose(task, "delete")),
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => manual && source.data.taskId !== task._id && drag.canDrop(source.data.taskId),
        onDrag: ({ location }) =>
          setOver(
            location.current.input.clientY < element.getBoundingClientRect().top + element.offsetHeight / 2
              ? "before"
              : "after"
          ),
        onDragLeave: () => setOver(null),
        onDrop: ({ source, location }) => {
          setOver(null);
          if (!drag.canDrop(source.data.taskId)) return;
          const midpoint = element.getBoundingClientRect().top + element.offsetHeight / 2;
          void drag.move(group, row, location.current.input.clientY >= midpoint);
        },
      })
    );
  }, [board, drag, row, group, manual, task, lifecycle]);
  const href = `/${workspaceSlug}/browse/${row.project.identifier}-${row.task.sequence}/`;
  const workItem = `${row.project.identifier}-${row.task.sequence}`;
  const peeked = params.get("peek") === workItem;
  const open = () => {
    if (isMobile) navigate(href);
    else
      setParams((current) => {
        const next = new URLSearchParams(current);
        next.set("peek", workItem);
        return next;
      });
  };
  const identifier = (
    <IdentifierText
      identifier={`${row.project.identifier}-${row.task.sequence}`}
      minWidth={calculateIdentifierWidth(row.project.identifier.length, row.task.sequence)}
      size="sm"
    />
  );
  const propertyControls = (
    <TaskRowProperties task={task} display={properties} disabled={lifecycle.pending || drag.pending} />
  );
  return (
    <TaskLifecycle
      task={task}
      href={href}
      disabled={drag.pending}
      lifecycle={lifecycle}
      row={(menu) =>
        board ? (
          <>
            <KanbanIssueBlockView
              issueId={row.task._id}
              blockId={`issue-${row.task._id}`}
              href={href}
              name={row.task.title}
              onOpen={open}
              cardRef={cardRef}
              onDragStart={undefined}
              isPeeked={peeked}
              isDragging={drag.dragged === task._id}
              isDraggingOver={over === "before"}
              canDrag={drag.enabled && task.canEdit && !lifecycle.pending}
              disabled={lifecycle.pending || drag.pending}
              identifier={properties.key ? identifier : null}
              properties={propertyControls}
              actions={() => menu}
              shouldRenderByDefault
            />
            {over === "after" && <DropIndicator isVisible />}
          </>
        ) : (
          <IssueListBlockView
            issueId={row.task._id}
            href={href}
            name={row.task.title}
            ariaLabel={`${row.project.identifier}-${row.task.sequence}: ${row.task.title}`}
            onOpen={open}
            rowRef={rowRef}
            onDragStart={undefined}
            isPeeked={peeked}
            isPeekedAtCurrentLevel={peeked}
            isActive={false}
            isSelected={false}
            isDragging={false}
            disabled={false}
            pending={lifecycle.pending}
            identifier={properties.key ? identifier : null}
            indent={0}
            selection={null}
            expansion={null}
            properties={propertyControls}
            actions={() => menu}
          />
        )
      }
    />
  );
}
