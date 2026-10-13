/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { CheckSquareIcon, ListChecksIcon, PencilSimpleLineIcon, UsersThreeIcon } from "@phosphor-icons/react";
import Link from "next/link";
import useSWR from "swr";
import { CheckCircle2, ChevronDown, Circle, CircleDashed, CircleDot, Plus, Search, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { EUserPermissions, EUserPermissionsLevel, ISSUE_PRIORITIES } from "@plane/constants";
import { useLocalStorage } from "@plane/hooks";
import { EIssuesStoreType } from "@plane/types";
import type { TStateGroups } from "@plane/types";
import { Avatar } from "@plane/propel/avatar";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { PriorityIcon, SelectableIcon } from "@plane/propel/icons";
import type { TSelectableIcon } from "@plane/propel/icons";
import { Tabs } from "@plane/propel/tabs";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Collapsible } from "@plane/propel/collapsible";
import { getFileURL, renderFormattedDateWithoutYear } from "@plane/utils";
import { PageHead } from "@/components/core/page-title";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonPageHeader } from "@/components/summon/screen";
import { useHashTab } from "@/components/summon/use-hash-tab";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useLabel } from "@/hooks/store/use-label";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { IssueService } from "@/services/issue";
import { listAccessiblePlaneIssues } from "@/services/summon-plane.service";
import {
  DEFAULT_TASK_DISPLAY,
  STATUS_ORDER,
  countActiveFilters,
  filterTasks,
  groupTasks,
  isTaskCompleted,
  sortTasks,
  taskStatus,
  type TTaskCenterScope,
  type TTaskDisplay,
  type TTaskFilterField,
  type TTaskFilters,
} from "./task-center";
import {
  AppliedTaskFilters,
  DATE_FILTER_OPTIONS,
  TaskDisplayPopover,
  TaskFilterMenu,
  type TTaskFilterOptions,
} from "./task-view-controls";

const scopes: { value: TTaskCenterScope; label: string; icon: TSelectableIcon }[] = [
  { value: "mine", label: "My tasks", icon: CheckSquareIcon },
  { value: "team", label: "Team tasks", icon: UsersThreeIcon },
  { value: "created", label: "Created by me", icon: PencilSimpleLineIcon },
  { value: "all", label: "All tasks", icon: ListChecksIcon },
];
const STATUS_META: Record<TStateGroups, { label: string; Icon: LucideIcon; tone: string }> = {
  started: { label: "In progress", Icon: CircleDot, tone: "text-accent-primary" },
  unstarted: { label: "To do", Icon: Circle, tone: "text-secondary" },
  backlog: { label: "Backlog", Icon: CircleDashed, tone: "text-secondary" },
  completed: { label: "Done", Icon: CheckCircle2, tone: "text-success-primary" },
  cancelled: { label: "Cancelled", Icon: XCircle, tone: "text-secondary" },
};
type TTaskView = { filters: TTaskFilters; display: TTaskDisplay };
const DEFAULT_VIEW: TTaskView = { filters: {}, display: DEFAULT_TASK_DISPLAY };

const issueService = new IssueService();
const metaIcon = ({ Icon, tone }: { Icon: LucideIcon; tone: string }) => (
  <Icon aria-hidden="true" className={`size-4 flex-none ${tone}`} />
);

export const TasksRoot = observer(function TasksRoot({ workspaceSlug }: { workspaceSlug: string }) {
  const { data: currentUser } = useUser();
  const { joinedProjectIds } = useProject();
  const { allowPermissions } = useUserPermissions();
  const { getUserDetails, workspace: workspaceMembers } = useMember();
  const projectStates = useProjectState();
  const labels = useLabel();
  const { toggleCreateIssueModal } = useCommandPalette();
  const {
    data: records = [],
    error,
    isLoading,
    mutate,
  } = useSWR(["summon-plane-issues", workspaceSlug], () => listAccessiblePlaneIssues(workspaceSlug));
  const [today, setToday] = useState("");
  const [scope, setScope] = useHashTab(scopes.map((item) => item.value));
  const [query, setQuery] = useState("");
  // The view persists per workspace and viewer, like a Linear view's filters and display options.
  const { storedValue, setValue: setView } = useLocalStorage<TTaskView>(
    `summon-tasks-view:${workspaceSlug}`,
    DEFAULT_VIEW
  );
  const filters = storedValue?.filters ?? {};
  const display = { ...DEFAULT_TASK_DISPLAY, ...storedValue?.display };
  const canCreate =
    joinedProjectIds.length > 0 &&
    allowPermissions([EUserPermissions.ADMIN, EUserPermissions.MEMBER], EUserPermissionsLevel.WORKSPACE);
  useEffect(() => {
    const now = new Date();
    setToday(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    );
  }, []);
  useEffect(() => {
    if (!workspaceMembers.workspaceMemberMap[workspaceSlug]) void workspaceMembers.fetchWorkspaceMembers(workspaceSlug);
    if (!projectStates.fetchedMap[workspaceSlug]) void projectStates.fetchWorkspaceStates(workspaceSlug);
    if (!labels.fetchedMap[workspaceSlug]) void labels.fetchWorkspaceLabels(workspaceSlug);
  }, [labels, projectStates, workspaceMembers, workspaceSlug]);

  const tasks = records.map(({ issue, project }) => {
    const state = projectStates.getStateById(issue.state_id);
    return {
      ...issue,
      label_ids: issue.label_ids ?? [],
      project,
      stateGroup: state?.group ?? issue.state__group,
      stateName: state?.name,
      assignees: issue.assignee_ids.map((id) => getUserDetails(id)).filter(Boolean),
    };
  });
  const searched = filterTasks(tasks, {
    scope,
    filters,
    display,
    currentUserId: currentUser?.id,
    today,
    now: Date.now(),
  }).filter((task) =>
    `${task.name} ${task.project.name} ${task.project.identifier}-${task.sequence_id}`
      .toLowerCase()
      .includes(query.trim().toLowerCase())
  );
  const projects = Array.from(new Map(records.map(({ project }) => [project.id, project])).values());
  const memberIds = (ids: string[]) => {
    const unique = [...new Set(ids)];
    unique.sort((a, b) =>
      a === currentUser?.id
        ? -1
        : b === currentUser?.id
          ? 1
          : (getUserDetails(a)?.display_name ?? "").localeCompare(getUserDetails(b)?.display_name ?? "")
    );
    return unique;
  };
  const memberOption = (id: string) => {
    const person = getUserDetails(id);
    return {
      value: id,
      label: person?.display_name ?? "Unknown member",
      icon: <Avatar size={16} name={person?.display_name} src={getFileURL(person?.avatar_url ?? "")} />,
    };
  };
  const assigneeIds = memberIds(tasks.flatMap((task) => task.assignee_ids));
  const labelIds = [...new Set(tasks.flatMap((task) => task.label_ids))].filter((id) => labels.getLabelById(id));
  const filterOptions: TTaskFilterOptions = {
    status: STATUS_ORDER.map((value) => ({
      value,
      label: STATUS_META[value].label,
      icon: metaIcon(STATUS_META[value]),
    })),
    assignee: [
      {
        value: "none",
        label: "No assignee",
        icon: <span className="size-4 rounded-full border border-dashed border-strong" />,
      },
      ...assigneeIds.map(memberOption),
    ],
    creator: memberIds(tasks.map((task) => task.created_by)).map(memberOption),
    priority: ISSUE_PRIORITIES.map(({ key, title }) => ({
      value: key,
      label: title,
      icon: <PriorityIcon priority={key} size={16} />,
    })),
    label: labelIds.length
      ? [
          { value: "none", label: "No labels" },
          ...labelIds.map((id) => {
            const label = labels.getLabelById(id);
            return {
              value: id,
              label: label?.name ?? id,
              icon: <span className="size-2.5 flex-none rounded-full" style={{ backgroundColor: label?.color }} />,
            };
          }),
        ]
      : [],
    project: projects.map((project) => ({ value: project.id, label: project.name })),
    ...DATE_FILTER_OPTIONS,
  };
  const groups = groupTasks(sortTasks(searched, display), display, {
    assignee: assigneeIds,
    project: projects.map((project) => project.id),
  });
  const shows = (property: TTaskDisplay["properties"][number]) => display.properties.includes(property);
  const groupHeading = (key: string) => {
    switch (display.grouping) {
      case "status":
      case "priority":
        return filterOptions[display.grouping].find((option) => option.value === key) ?? { label: key, icon: null };
      case "assignee":
        return key === "none"
          ? { label: "No assignee", icon: <span className="size-4 rounded-full border border-dashed border-strong" /> }
          : memberOption(key);
      case "project":
        return { label: projects.find((project) => project.id === key)?.name ?? "No project", icon: null };
      case "none":
        return { label: "All tasks", icon: null };
    }
  };

  const updateView = (next: Partial<TTaskView>) => setView({ filters, display, ...next });
  const toggleFilter = (field: TTaskFilterField, value: string) => {
    const current: string[] = filters[field] ?? [];
    const values = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    updateView({ filters: { ...filters, [field]: values } });
  };
  const clearFilters = () => {
    setQuery("");
    updateView({ filters: {} });
  };
  const reassign = async (projectId: string, issueId: string, nextAssigneeIds: string[]) => {
    const withAssignees = (items: typeof records = []) =>
      items.map((record) =>
        record.issue.id === issueId ? { ...record, issue: { ...record.issue, assignee_ids: nextAssigneeIds } } : record
      );
    try {
      await mutate(
        async (current) => {
          await issueService.patchIssue(workspaceSlug, projectId, issueId, { assignee_ids: nextAssigneeIds });
          return withAssignees(current);
        },
        { optimisticData: withAssignees, rollbackOnError: true, revalidate: false }
      );
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Assignees not updated", message: "Try again in a moment." });
    }
  };

  return (
    <section className="flex min-h-full min-w-0 flex-col bg-surface-1">
      <PageHead title="Tasks · Summon Core" />
      <div className="border-b border-subtle px-4 py-3 sm:px-6">
        <SummonPageHeader
          title="Tasks"
          description={
            <span className="tabular-nums" role="status">
              {isLoading || error ? "\u00a0" : `${searched.length} ${searched.length === 1 ? "task" : "tasks"}`}
            </span>
          }
          actions={
            <Button
              size="lg"
              prependIcon={<Plus aria-hidden="true" />}
              disabled={!canCreate}
              onClick={() => toggleCreateIssueModal(true, EIssuesStoreType.PROJECT)}
            >
              New task
            </Button>
          }
        />
      </div>
      <Tabs
        variant="underline"
        value={scope}
        onValueChange={(value) => {
          const next = scopes.find((item) => item.value === value);
          if (next) setScope(next.value);
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle px-4 sm:px-6">
          <Tabs.List aria-label="Task ownership" className="w-auto max-w-full border-b-0">
            {scopes.map((item) => (
              <Tabs.Trigger key={item.value} value={item.value} className="h-11">
                <SelectableIcon icon={item.icon} />
                {item.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 py-1.5 sm:flex-none">
            <label htmlFor="task-search" className="relative min-w-0 flex-1 sm:w-56">
              <span className="sr-only">Search tasks</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-secondary"
              />
              <Input
                id="task-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tasks…"
                className="h-8 w-full pl-8 text-base sm:text-13"
              />
            </label>
            <TaskFilterMenu filters={filters} options={filterOptions} onToggle={toggleFilter} />
            <TaskDisplayPopover display={display} onChange={(next) => updateView({ display: next })} />
          </div>
        </div>
        <AppliedTaskFilters
          filters={filters}
          options={filterOptions}
          onClearField={(field) => updateView({ filters: { ...filters, [field]: [] } })}
          onClearAll={() => updateView({ filters: {} })}
        />
        <Tabs.Content value={scope} className="min-w-0 flex-1">
          <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />
          {!isLoading && !error && (
            <div className="py-2">
              {groups.map(({ key, items }) => {
                const rows = (
                  <ul>
                    {items.map((task) => {
                      const overdue = today && task.target_date && task.target_date < today && !isTaskCompleted(task);
                      const status = STATUS_META[taskStatus(task)];
                      const priority = ISSUE_PRIORITIES.find((option) => option.key === (task.priority ?? "none"));
                      return (
                        <li
                          key={task.id}
                          className="relative flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 text-13 transition-colors hover:bg-layer-transparent-hover has-[a:focus-visible]:bg-layer-transparent-hover sm:flex-nowrap sm:px-6"
                        >
                          {shows("priority") && (
                            <span role="img" aria-label={`Priority: ${priority?.title}`} className="flex shrink-0">
                              <PriorityIcon priority={task.priority} size={16} />
                            </span>
                          )}
                          {shows("id") && (
                            <span
                              className="w-20 shrink-0 truncate text-secondary"
                              title={`${task.project.identifier}-${task.sequence_id}`}
                            >
                              {task.project.identifier}-{task.sequence_id}
                            </span>
                          )}
                          {shows("status") && (
                            <status.Icon
                              aria-label={`Status: ${task.stateName ?? status.label}`}
                              className={`size-4 shrink-0 ${status.tone}`}
                            />
                          )}
                          {/* The title link stretches over the row; the project and assignee controls sit above it. */}
                          <Link
                            href={`/${workspaceSlug}/projects/${task.project.id}/issues/${task.id}/`}
                            className="min-w-0 flex-[1_1_50%] font-medium break-words text-primary outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent-strong sm:flex-1"
                          >
                            {task.name}
                          </Link>
                          <span className="relative ml-7 flex min-w-0 flex-wrap items-center gap-3 text-secondary sm:ml-0 sm:flex-nowrap sm:justify-end">
                            {shows("labels") &&
                              task.label_ids.map((id) => {
                                const label = labels.getLabelById(id);
                                return label ? (
                                  <span
                                    key={id}
                                    className="flex max-w-32 items-center gap-1.5 rounded-full border border-subtle px-2 py-0.5 text-12"
                                  >
                                    <span
                                      className="size-2 flex-none rounded-full"
                                      style={{ backgroundColor: label.color }}
                                    />
                                    <span className="truncate">{label.name}</span>
                                  </span>
                                ) : null;
                              })}
                            {shows("project") && (
                              <Link
                                href={`/${workspaceSlug}/summon/projects/${task.project.id}/`}
                                className="max-w-48 truncate rounded border border-subtle px-2 py-0.5 text-12 hover:border-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-accent-strong"
                                title={task.project.name}
                              >
                                {task.project.name}
                              </Link>
                            )}
                            {shows("assignee") && (
                              <MemberDropdown
                                projectId={task.project.id}
                                value={task.assignee_ids}
                                onChange={(ids) => void reassign(task.project.id, task.id, ids)}
                                multiple
                                buttonVariant="transparent-without-text"
                                placeholder="Assignees"
                                placement="bottom-end"
                                buttonContainerClassName="rounded-full focus-visible:outline-2 focus-visible:outline-accent-strong"
                                button={
                                  <span className="flex -space-x-1 rounded-full">
                                    {task.assignees
                                      .slice(0, 3)
                                      .map(
                                        (person) =>
                                          person && (
                                            <Avatar
                                              key={person.id}
                                              size={22}
                                              name={person.display_name}
                                              src={getFileURL(person.avatar_url ?? "")}
                                            />
                                          )
                                      )}
                                    {!task.assignees.length && (
                                      <span className="size-5 rounded-full border border-dashed border-strong" />
                                    )}
                                  </span>
                                }
                              />
                            )}
                            {shows("due") && (
                              <span
                                className={`w-16 shrink-0 text-right tabular-nums ${overdue ? "text-danger-primary" : "text-secondary"}`}
                                title={task.target_date ? `Due ${task.target_date}` : "No due date"}
                              >
                                {task.target_date
                                  ? `${overdue ? "! " : ""}${renderFormattedDateWithoutYear(task.target_date)}`
                                  : "—"}
                              </span>
                            )}
                            {shows("created") && (
                              <span
                                className="shrink-0 text-tertiary tabular-nums sm:w-16 sm:text-right"
                                title={`Created ${task.created_at}`}
                              >
                                {renderFormattedDateWithoutYear(task.created_at)}
                              </span>
                            )}
                            {shows("updated") && (
                              <span
                                className="shrink-0 text-tertiary tabular-nums sm:w-16 sm:text-right"
                                title={`Updated ${task.updated_at}`}
                              >
                                {renderFormattedDateWithoutYear(task.updated_at)}
                              </span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                );
                if (display.grouping === "none") return <div key={key}>{rows}</div>;
                const heading = groupHeading(key);
                return (
                  <Collapsible.CollapsibleRoot key={key} defaultOpen className="mb-2">
                    <h2>
                      <Collapsible.CollapsibleTrigger className="group flex min-h-9 w-full items-center gap-2 border-b border-subtle px-4 text-left text-13 font-medium text-primary transition-colors hover:bg-layer-transparent-hover focus-visible:outline-2 focus-visible:outline-accent-strong sm:px-6">
                        <ChevronDown
                          aria-hidden="true"
                          className="size-3.5 -rotate-90 group-data-[panel-open]:rotate-0"
                        />
                        {heading.icon}
                        {heading.label}
                        <span className="ml-1 text-secondary tabular-nums">{items.length}</span>
                      </Collapsible.CollapsibleTrigger>
                    </h2>
                    <Collapsible.CollapsibleContent>{rows}</Collapsible.CollapsibleContent>
                  </Collapsible.CollapsibleRoot>
                );
              })}
              {!searched.length && (
                <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center">
                  <CheckCircle2 aria-hidden="true" className="size-8 text-secondary" />
                  <h2 className="text-sm font-medium text-primary">No tasks in this view</h2>
                  <p className="text-13 text-secondary">
                    {countActiveFilters(filters) || query
                      ? "Clear your filters or search to see more."
                      : "Choose another scope or change the display options."}
                  </p>
                  {(countActiveFilters(filters) > 0 || query) && (
                    <Button variant="secondary" size="base" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </Tabs.Content>
      </Tabs>
    </section>
  );
});
