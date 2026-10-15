/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { groupBy, mapValues } from "lodash-es";
import { observer } from "mobx-react";
import { CheckSquareIcon, ListChecksIcon, PencilSimpleLineIcon, UsersThreeIcon } from "@phosphor-icons/react";
import Link from "next/link";
import useSWR from "swr";
import { CheckCircle2, ChevronDown, Circle, CircleDashed, CircleDot, Plus, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { EUserPermissions, EUserPermissionsLevel, ISSUE_PRIORITIES } from "@plane/constants";
import { useLocalStorage } from "@plane/hooks";
import { EIssuesStoreType } from "@plane/types";
import type { TStateGroups } from "@plane/types";
import { Avatar } from "@plane/propel/avatar";
import { Button } from "@plane/propel/button";
import { PriorityIcon, SelectableIcon } from "@plane/propel/icons";
import type { TSelectableIcon } from "@plane/propel/icons";
import { Tabs } from "@plane/propel/tabs";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Collapsible } from "@plane/propel/collapsible";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { Popover } from "@plane/propel/popover";
import { CircularProgressIndicator } from "@plane/ui";
import { getFileURL, renderFormattedDateWithoutYear } from "@plane/utils";
import { PageHead } from "@/components/core/page-title";
import { PROJECT_BADGE_CLASSNAME } from "@/components/summon/project-badge";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonPageHeader } from "@/components/summon/screen";
import { useHashTab } from "@/components/summon/use-hash-tab";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
import { StateDropdown } from "@/components/dropdowns/state/dropdown";
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
import { SummonSearchField } from "@/components/summon/search-field";
import { StatusBadge } from "@/components/summon/status-badge";
import type { TPlaneIssueIndexItem } from "@/services/summon-plane.service";

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

type TProgress = { total: number; done: number };

/** Hovering a task's project previews it, as in Linear: what it is, its health and lead, and how far along it is. */
const ProjectChip = observer(function ProjectChip({
  workspaceSlug,
  project,
  progress,
}: {
  workspaceSlug: string;
  project: TPlaneIssueIndexItem["project"];
  progress: TProgress;
}) {
  const { getProjectById, fetchProjectDetails } = useProject();
  const { getUserDetails } = useMember();
  const details = getProjectById(project.id);
  const leadId = typeof details?.project_lead === "string" ? details.project_lead : details?.project_lead?.id;
  const lead = leadId ? getUserDetails(leadId) : undefined;
  const percentage = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <Popover
      delay={300}
      openOnHover
      // The workspace project list leaves out descriptions; the first preview loads the full project.
      onOpenChange={(open) => {
        if (open && details?.description === undefined) void fetchProjectDetails(workspaceSlug, project.id);
      }}
    >
      <Popover.Button
        nativeButton={false}
        render={<Link href={`/${workspaceSlug}/summon/projects/${project.id}/`} className={PROJECT_BADGE_CLASSNAME} />}
      >
        {project.name}
      </Popover.Button>
      <Popover.Panel side="bottom" align="end">
        <div className="w-80 space-y-3 rounded-lg border-[0.5px] border-strong bg-surface-1 p-4 shadow-raised-200">
          <p className="text-12 text-tertiary">{project.identifier}</p>
          <p className="flex items-center gap-2 text-14 font-medium text-primary">
            {details?.logo_props?.in_use ? <Logo logo={details.logo_props} size={16} /> : null}
            <span className="min-w-0 truncate">{project.name}</span>
          </p>
          {details?.description ? <p className="line-clamp-3 text-13 text-secondary">{details.description}</p> : null}
          <div className="flex flex-wrap items-center gap-3 border-t border-subtle pt-3 text-12 text-secondary">
            <StatusBadge status={project.health} />
            {lead ? (
              <span className="flex min-w-0 items-center gap-1.5">
                <Avatar size={16} name={lead.display_name} src={getFileURL(lead.avatar_url ?? "")} />
                <span className="truncate">{lead.display_name}</span>
              </span>
            ) : null}
          </div>
          <p className="flex items-center gap-2 text-13 text-secondary tabular-nums">
            <CircularProgressIndicator
              size={18}
              percentage={percentage}
              strokeWidth={3}
              strokeColor="stroke-accent-primary"
            />
            <span className="font-medium text-primary">{percentage}%</span> of {progress.total}{" "}
            {progress.total === 1 ? "task" : "tasks"} done
          </p>
        </div>
      </Popover.Panel>
    </Popover>
  );
});

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
  // Progress counts every task in the project, not just the ones this view shows.
  const progressByProject = mapValues(
    groupBy(tasks, (task) => task.project.id),
    (group): TProgress => ({ total: group.length, done: group.filter(isTaskCompleted).length })
  );
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
  // IDs share one column sized to the longest shown, so the status sits right after them, as in Linear.
  const idWidth = `${Math.max(0, ...searched.map((task) => `${task.project.identifier}-${task.sequence_id}`.length))}ch`;
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
  const updateTask = async (
    projectId: string,
    issueId: string,
    patch: Partial<Pick<(typeof records)[number]["issue"], "assignee_ids" | "state_id">>,
    failure: string
  ) => {
    const patched = (items: typeof records = []) =>
      items.map((record) =>
        record.issue.id === issueId ? { ...record, issue: { ...record.issue, ...patch } } : record
      );
    try {
      // Patch the cache as it is when the request lands, so overlapping edits keep each other.
      await mutate(issueService.patchIssue(workspaceSlug, projectId, issueId, patch), {
        optimisticData: patched,
        populateCache: (_result, latest) => patched(latest),
        rollbackOnError: true,
        revalidate: false,
      });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: failure, message: "Try again in a moment." });
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
          <div className="flex min-w-0 grow basis-full items-center justify-end gap-2 py-1.5 sm:ml-auto sm:grow-0 sm:basis-auto">
            <SummonSearchField
              id="task-search"
              label="Search tasks"
              placeholder="Search tasks…"
              value={query}
              onValueChange={setQuery}
              size="base"
              className="flex-1 sm:w-56 sm:flex-none"
            />
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
                              className="shrink-0 truncate text-secondary"
                              style={{ width: idWidth }}
                              title={`${task.project.identifier}-${task.sequence_id}`}
                            >
                              {task.project.identifier}-{task.sequence_id}
                            </span>
                          )}
                          {shows("status") && (
                            // Comes before the stretched title link, so it needs z-1 to sit above it.
                            <span className="relative z-1 flex shrink-0">
                              <StateDropdown
                                projectId={task.project.id}
                                value={task.state_id}
                                onChange={(stateId) =>
                                  void updateTask(task.project.id, task.id, { state_id: stateId }, "Status not updated")
                                }
                                buttonVariant="transparent-without-text"
                                buttonClassName="size-6 justify-center px-0"
                                showTooltip
                                showDefaultState={false}
                                placement="bottom-start"
                              />
                            </span>
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
                                    <span className="truncate" title={label.name}>
                                      {label.name}
                                    </span>
                                  </span>
                                ) : null;
                              })}
                            {shows("project") && (
                              <ProjectChip
                                workspaceSlug={workspaceSlug}
                                project={task.project}
                                progress={progressByProject[task.project.id]}
                              />
                            )}
                            {shows("assignee") && (
                              <MemberDropdown
                                projectId={task.project.id}
                                value={task.assignee_ids}
                                onChange={(ids) =>
                                  void updateTask(
                                    task.project.id,
                                    task.id,
                                    { assignee_ids: ids },
                                    "Assignees not updated"
                                  )
                                }
                                multiple
                                buttonVariant="transparent-without-text"
                                placeholder="Assignees"
                                placement="bottom-end"
                                buttonContainerClassName="rounded-full focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent-strong"
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
                      <Collapsible.CollapsibleTrigger className="group flex min-h-9 w-full items-center gap-2 border-b border-subtle px-4 text-left text-13 font-medium text-primary transition-colors hover:bg-layer-transparent-hover focus-visible:outline-2 focus-visible:outline-accent-strong focus-visible:outline-solid sm:px-6">
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
