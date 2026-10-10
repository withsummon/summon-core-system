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
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDashed,
  CircleDot,
  Filter,
  Plus,
  Search,
  XCircle,
} from "lucide-react";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { EIssuesStoreType } from "@plane/types";
import { Avatar } from "@plane/propel/avatar";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { Select } from "@plane/propel/select";
import { SelectableIcon } from "@plane/propel/icons";
import type { TSelectableIcon } from "@plane/propel/icons";
import { Tabs } from "@plane/propel/tabs";
import { Collapsible } from "@plane/propel/collapsible";
import { getFileURL } from "@plane/utils";
import { PageHead } from "@/components/core/page-title";
import { SummonRequestState } from "@/components/summon/request-state";
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { listAccessiblePlaneIssues } from "@/services/summon-plane.service";
import { filterTaskCenterItems, isTaskCompleted, type TTaskCenterDue, type TTaskCenterScope } from "./task-center";

const scopes: { value: TTaskCenterScope; label: string; icon: TSelectableIcon }[] = [
  { value: "mine", label: "My tasks", icon: CheckSquareIcon },
  { value: "team", label: "Team tasks", icon: UsersThreeIcon },
  { value: "created", label: "Created by me", icon: PencilSimpleLineIcon },
  { value: "all", label: "All tasks", icon: ListChecksIcon },
];
const dueOptions: { value: TTaskCenterDue; label: string }[] = [
  { value: "all", label: "Any date" },
  { value: "today", label: "Today" },
  { value: "overdue", label: "Overdue" },
  { value: "week", label: "This week" },
  { value: "next7", label: "Next 7 days" },
  { value: "completed", label: "Completed" },
];
const groups = [
  { value: "started", label: "In progress", Icon: CircleDot, tone: "text-accent-primary" },
  { value: "unstarted", label: "To do", Icon: Circle, tone: "text-secondary" },
  { value: "backlog", label: "Backlog", Icon: CircleDashed, tone: "text-secondary" },
  { value: "completed", label: "Done", Icon: CheckCircle2, tone: "text-success-primary" },
  { value: "cancelled", label: "Cancelled", Icon: XCircle, tone: "text-secondary" },
];
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${date}T00:00:00`));

export const TasksRoot = observer(function TasksRoot({ workspaceSlug }: { workspaceSlug: string }) {
  const { data: currentUser } = useUser();
  const { joinedProjectIds } = useProject();
  const { allowPermissions } = useUserPermissions();
  const { getUserDetails, workspace: workspaceMembers } = useMember();
  const projectStates = useProjectState();
  const { toggleCreateIssueModal } = useCommandPalette();
  const {
    data: records = [],
    error,
    isLoading,
    mutate,
  } = useSWR(["summon-plane-issues", workspaceSlug], () => listAccessiblePlaneIssues(workspaceSlug));
  const [today, setToday] = useState("");
  const [scope, setScope] = useState<TTaskCenterScope>("mine");
  const [due, setDue] = useState<TTaskCenterDue>("all");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
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
  }, [projectStates, workspaceMembers, workspaceSlug]);

  const tasks = records.map(({ issue, project }) => {
    const state = projectStates.getStateById(issue.state_id);
    return {
      ...issue,
      project,
      stateGroup: state?.group ?? issue.state__group,
      stateName: state?.name,
      assignees: issue.assignee_ids.map((id) => getUserDetails(id)).filter(Boolean),
    };
  });
  const filtered = filterTaskCenterItems(tasks, { scope, due, currentUserId: currentUser?.id, today }).filter(
    (task) =>
      `${task.name} ${task.project.name} ${task.project.identifier}-${task.sequence_id}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()) &&
      (projectFilter === "all" || task.project.id === projectFilter) &&
      (priorityFilter === "all" || (task.priority ?? "none") === priorityFilter)
  );
  const projects = Array.from(new Map(records.map(({ project }) => [project.id, project])).values());
  const filterCount = Number(due !== "all") + Number(projectFilter !== "all") + Number(priorityFilter !== "all");
  const clearFilters = () => {
    setQuery("");
    setDue("all");
    setProjectFilter("all");
    setPriorityFilter("all");
  };

  return (
    <section className="flex min-h-full min-w-0 flex-col bg-surface-1">
      <PageHead title="Tasks · Summon Core" />
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-primary">Tasks</h1>
          <span className="text-13 text-secondary tabular-nums" role="status">
            {!isLoading && !error && filtered.length}
          </span>
        </div>
        <Button
          size="base"
          prependIcon={<Plus aria-hidden="true" />}
          disabled={!canCreate}
          onClick={() => toggleCreateIssueModal(true, EIssuesStoreType.PROJECT)}
        >
          New task
        </Button>
      </header>
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
            <Button
              variant="secondary"
              size="base"
              prependIcon={<Filter aria-hidden="true" />}
              aria-expanded={filtersOpen}
              aria-controls="task-filters"
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              Filters{filterCount > 0 ? ` · ${filterCount}` : ""}
            </Button>
          </div>
        </div>
        {filtersOpen && (
          <div
            id="task-filters"
            className="flex flex-wrap items-end gap-3 border-b border-subtle bg-layer-1 px-4 py-3 sm:px-6"
          >
            <label htmlFor="task-project" className="min-w-40 flex-1 text-13 text-secondary">
              Project
              <Select
                id="task-project"
                value={projectFilter}
                onValueChange={setProjectFilter}
                options={[
                  { value: "all", label: "All projects" },
                  ...projects.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
            </label>
            <label htmlFor="task-due" className="min-w-36 flex-1 text-13 text-secondary">
              Due date
              <Select
                id="task-due"
                value={due}
                onValueChange={(value) => {
                  const next = dueOptions.find((item) => item.value === value);
                  if (next) setDue(next.value);
                }}
                options={dueOptions}
              />
            </label>
            <label htmlFor="task-priority" className="min-w-36 flex-1 text-13 text-secondary">
              Priority
              <Select
                id="task-priority"
                value={priorityFilter}
                onValueChange={setPriorityFilter}
                options={["all", "urgent", "high", "medium", "low", "none"].map((value) => ({
                  value,
                  label: value === "all" ? "All priorities" : value.charAt(0).toUpperCase() + value.slice(1),
                }))}
              />
            </label>
            <Button variant="ghost" size="base" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        )}
        <Tabs.Content value={scope} className="min-w-0 flex-1">
          <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />
          {!isLoading && !error && (
            <div className="py-2">
              {groups.map(({ value, label, Icon, tone }) => {
                const items = filtered.filter(
                  (task) => (task.stateGroup ?? (task.completed_at ? "completed" : "unstarted")) === value
                );
                if (!items.length) return null;
                return (
                  <Collapsible.CollapsibleRoot key={value} defaultOpen className="mb-2">
                    <h2>
                      <Collapsible.CollapsibleTrigger className="group flex min-h-9 w-full items-center gap-2 bg-layer-1 px-4 text-left text-13 font-medium text-primary hover:bg-layer-2 focus-visible:outline-2 focus-visible:outline-accent-strong sm:px-6">
                        <ChevronDown
                          aria-hidden="true"
                          className="size-3.5 -rotate-90 group-data-[panel-open]:rotate-0"
                        />
                        <Icon aria-hidden="true" className={`size-4 ${tone}`} />
                        {label}
                        <span className="ml-1 text-secondary tabular-nums">{items.length}</span>
                      </Collapsible.CollapsibleTrigger>
                    </h2>
                    <Collapsible.CollapsibleContent>
                      <ul>
                        {items.map((task) => {
                          const PriorityIcon =
                            task.priority === "urgent" || task.priority === "high"
                              ? ArrowUp
                              : task.priority === "low"
                                ? ArrowDown
                                : Circle;
                          const overdue =
                            today && task.target_date && task.target_date < today && !isTaskCompleted(task);
                          return (
                            <li key={task.id}>
                              <Link
                                href={`/${workspaceSlug}/projects/${task.project.id}/issues/${task.id}/`}
                                className="group flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 text-13 hover:bg-layer-1 focus-visible:bg-layer-1 focus-visible:outline-2 focus-visible:outline-accent-strong sm:flex-nowrap sm:px-6"
                              >
                                <PriorityIcon
                                  aria-label={`Priority: ${task.priority ?? "none"}`}
                                  className={`size-4 shrink-0 ${task.priority === "urgent" ? "text-danger-primary" : "text-secondary"}`}
                                />
                                <span
                                  className="w-20 shrink-0 truncate text-secondary"
                                  title={`${task.project.identifier}-${task.sequence_id}`}
                                >
                                  {task.project.identifier}-{task.sequence_id}
                                </span>
                                <span className="min-w-0 flex-[1_1_50%] font-medium break-words text-primary sm:flex-1">
                                  {task.name}
                                </span>
                                <span className="ml-7 flex min-w-0 items-center gap-3 text-secondary sm:ml-0 sm:justify-end">
                                  <span
                                    className="max-w-48 truncate rounded border border-subtle px-2 py-0.5 text-12"
                                    title={task.project.name}
                                  >
                                    {task.project.name}
                                  </span>
                                  <span
                                    className="flex -space-x-1"
                                    aria-label={
                                      task.assignees.length
                                        ? `Assigned to ${task.assignees.map((person) => person?.display_name).join(", ")}`
                                        : "Unassigned"
                                    }
                                  >
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
                                  <span
                                    className={`w-16 shrink-0 text-right tabular-nums ${overdue ? "text-danger-primary" : "text-secondary"}`}
                                    title={task.target_date ?? "No due date"}
                                  >
                                    {task.target_date ? `${overdue ? "! " : ""}${dateLabel(task.target_date)}` : "—"}
                                  </span>
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </Collapsible.CollapsibleContent>
                  </Collapsible.CollapsibleRoot>
                );
              })}
              {!filtered.length && (
                <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center">
                  <CheckCircle2 aria-hidden="true" className="size-8 text-secondary" />
                  <h2 className="text-sm font-medium text-primary">No tasks in this view</h2>
                  <p className="text-13 text-secondary">Choose another scope or clear your filters.</p>
                  <Button variant="secondary" size="base" onClick={clearFilters}>
                    Clear filters
                  </Button>
                </div>
              )}
            </div>
          )}
        </Tabs.Content>
      </Tabs>
    </section>
  );
});
