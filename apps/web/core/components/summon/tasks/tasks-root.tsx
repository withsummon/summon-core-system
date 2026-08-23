/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import useSWR from "swr";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleHelp,
  Clock3,
  Filter,
  Folder,
  LayoutGrid,
  List,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { EIssuesStoreType } from "@plane/types";
import { Avatar } from "@plane/ui";
import { getFileURL } from "@plane/utils";
import { PageHead } from "@/components/core/page-title";
import { SummonRequestState } from "@/components/summon/request-state";
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { listAccessiblePlaneIssues } from "@/services/summon-plane.service";
import {
  filterTaskCenterItems,
  isTaskCompleted,
  summarizeTaskCenterItems,
  type TTaskCenterDue,
  type TTaskCenterScope,
} from "./task-center";

interface ITasksRootProps {
  workspaceSlug: string;
}

const scopeTabs: Array<{ id: TTaskCenterScope; label: string }> = [
  { id: "mine", label: "My Tasks" },
  { id: "team", label: "Team Tasks" },
  { id: "created", label: "Assigned by Me" },
  { id: "all", label: "All Tasks" },
];

const dueTabs: Array<{ id: TTaskCenterDue; label: string }> = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "overdue", label: "Overdue" },
  { id: "week", label: "This Week" },
  { id: "next7", label: "Next 7 Days" },
  { id: "completed", label: "Completed" },
];

const padDatePart = (value: number) => String(value).padStart(2, "0");

const localDateKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${padDatePart(now.getMonth() + 1)}-${padDatePart(now.getDate())}`;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(`${value}T00:00:00`)
  );

const dueLabel = (value: string | null, today: string) => {
  if (!value) return "No due date";
  if (!today) return formatDate(value);
  const days = Math.round((new Date(`${value}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 864e5);
  if (days < 0) return `${Math.abs(days)} day${days === -1 ? "" : "s"} overdue`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return `In ${days} days`;
  return formatDate(value);
};

const dueTone = (value: string | null, today: string) => {
  if (!value || !today) return "text-secondary";
  if (value <= today) return "text-red-600";
  const days = Math.round((new Date(`${value}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 864e5);
  return days <= 3 ? "text-amber-600" : "text-secondary";
};

const priorityStyle = (priority?: string | null) => {
  if (priority === "urgent" || priority === "high")
    return { label: priority === "urgent" ? "Urgent" : "High", tone: "bg-red-50 text-red-600", Icon: ArrowUp };
  if (priority === "medium") return { label: "Medium", tone: "bg-amber-50 text-amber-600", Icon: ArrowUp };
  if (priority === "low") return { label: "Low", tone: "bg-emerald-50 text-emerald-600", Icon: ArrowDown };
  return { label: "None", tone: "bg-layer-1 text-tertiary", Icon: Circle };
};

const stateStyle = (group?: string | null) => {
  if (group === "completed" || group === "cancelled") return "bg-emerald-50 text-emerald-700";
  if (group === "started") return "bg-blue-50 text-blue-700";
  return "bg-layer-1 text-secondary";
};

function Panel(props: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-subtle bg-surface-1 ${props.className ?? ""}`}>
      <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <h2 className="text-sm font-semibold text-primary">{props.title}</h2>
        {props.action}
      </header>
      {props.children}
    </section>
  );
}

export const TasksRoot = observer(function TasksRoot({ workspaceSlug }: ITasksRootProps) {
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const canCreateTask =
    joinedProjectIds.length > 0 &&
    allowPermissions([EUserPermissions.ADMIN, EUserPermissions.MEMBER], EUserPermissionsLevel.WORKSPACE);

  useEffect(() => setToday(localDateKey()), []);
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
      stateName: state?.name ?? (issue.completed_at ? "Completed" : "To Do"),
      assignees: issue.assignee_ids.map((id) => getUserDetails(id)).filter(Boolean),
    };
  });
  const scopedTasks = filterTaskCenterItems(tasks, {
    scope,
    due: "all",
    currentUserId: currentUser?.id,
    today,
  });
  const filteredTasks = filterTaskCenterItems(tasks, { scope, due, currentUserId: currentUser?.id, today }).filter(
    (task) =>
      `${task.name} ${task.project.name}`.toLowerCase().includes(query.trim().toLowerCase()) &&
      (projectFilter === "all" || task.project.id === projectFilter) &&
      (priorityFilter === "all" || (task.priority ?? "none") === priorityFilter)
  );
  const projects = Array.from(new Map(records.map(({ project }) => [project.id, project])).values());
  const summary = summarizeTaskCenterItems(scopedTasks, today);
  const counts = Object.fromEntries(
    dueTabs.map((tab) => [
      tab.id,
      filterTaskCenterItems(tasks, { scope, due: tab.id, currentUserId: currentUser?.id, today }).length,
    ])
  ) as Record<TTaskCenterDue, number>;
  const pageCount = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedTasks = filteredTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const upcoming = scopedTasks
    .filter((task) => !isTaskCompleted(task) && task.target_date && (!today || task.target_date >= today))
    // eslint-disable-next-line unicorn/no-array-sort -- filter returns a fresh array and this target excludes ES2023 toSorted.
    .sort((left, right) => (left.target_date ?? "").localeCompare(right.target_date ?? ""))
    .slice(0, 4);
  const overdue = scopedTasks
    .filter((task) => !isTaskCompleted(task) && task.target_date && today && task.target_date < today)
    // eslint-disable-next-line unicorn/no-array-sort -- filter returns a fresh array and this target excludes ES2023 toSorted.
    .sort((left, right) => (left.target_date ?? "").localeCompare(right.target_date ?? ""))
    .slice(0, 4);
  const byProject = Array.from(
    scopedTasks.reduce(
      (groups, task) => groups.set(task.project.id, (groups.get(task.project.id) ?? 0) + 1),
      new Map<string, number>()
    )
  )
    .map(([id, count]) => ({ id, count, project: records.find(({ project }) => project.id === id)?.project }))
    // eslint-disable-next-line unicorn/no-array-sort -- map returns a fresh array and this target excludes ES2023 toSorted.
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
  const maxProjectTasks = Math.max(...byProject.map(({ count }) => count), 1);
  const completedWithDates = scopedTasks.filter(
    (task) => isTaskCompleted(task) && task.completed_at && task.target_date
  );
  const onTimeCount = completedWithDates.filter((task) => task.completed_at!.slice(0, 10) <= task.target_date!).length;
  const onTimeRate = completedWithDates.length ? Math.round((onTimeCount / completedWithDates.length) * 100) : null;

  useEffect(() => setPage(1), [due, pageSize, priorityFilter, projectFilter, query, scope]);

  return (
    <section className="mx-auto min-h-full w-full max-w-[1600px] overflow-hidden p-4 lg:p-5">
      <PageHead title="Task Center · Summon Core" />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Task Center</h1>
          <p className="text-xs mt-1 text-secondary">Manage your tasks, stay on track, and get things done.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canCreateTask}
            onClick={() => toggleCreateIssueModal(true, EIssuesStoreType.PROJECT)}
            className="text-xs shadow-sm inline-flex h-10 items-center gap-2 rounded-xl bg-accent-primary px-4 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="size-4" /> New Task <ChevronDown className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setSearchOpen((open) => !open)}
            aria-label="Search tasks"
            className="grid size-10 place-items-center rounded-xl border border-subtle bg-surface-1 text-secondary"
          >
            <Search className="size-4" />
          </button>
          <Link
            href={`/${workspaceSlug}/summon/notifications/`}
            aria-label="Notifications"
            className="grid size-10 place-items-center rounded-xl border border-subtle bg-surface-1 text-secondary"
          >
            <Bell className="size-4" />
          </Link>
          <Link
            href={`/${workspaceSlug}/summon/knowledge/`}
            aria-label="Help"
            className="hidden size-10 place-items-center rounded-xl border border-subtle bg-surface-1 text-secondary sm:grid"
          >
            <CircleHelp className="size-4" />
          </Link>
        </div>
      </header>

      <nav className="mt-7 flex gap-6 overflow-x-auto border-b border-subtle" aria-label="Task ownership">
        {scopeTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setScope(tab.id)}
            className={`text-xs shrink-0 border-b-2 px-1 pb-3 font-medium ${scope === tab.id ? "border-accent-primary text-accent-primary" : "border-transparent text-secondary"}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {searchOpen && (
        <label className="relative mt-3 block max-w-md">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tertiary" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tasks or projects..."
            className="text-xs h-10 w-full rounded-xl border border-subtle bg-surface-1 pr-3 pl-9 text-primary outline-none focus:border-accent-strong"
          />
        </label>
      )}

      <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />

      {!isLoading && !error && (
        <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <main className="min-w-0 space-y-4">
            <section className="overflow-hidden rounded-2xl border border-subtle bg-surface-1">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle px-4 py-3">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {dueTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setDue(tab.id)}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-medium ${due === tab.id ? "border-accent-strong bg-accent-subtle text-accent-primary" : tab.id === "overdue" ? "border-red-100 bg-red-50 text-red-600" : "border-subtle bg-surface-1 text-secondary"}`}
                    >
                      {tab.label}
                      {tab.id !== "completed" && (
                        <span className="rounded-md bg-layer-1 px-1.5 py-0.5 text-[10px]">{counts[tab.id]}</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden items-center rounded-lg border border-subtle p-0.5 md:flex">
                    <button
                      type="button"
                      className="flex items-center gap-1.5 rounded-md bg-accent-subtle px-2.5 py-1.5 text-[11px] font-medium text-accent-primary"
                    >
                      <List className="size-3.5" /> List
                    </button>
                    <Link
                      href={`/${workspaceSlug}/workspace-views/all-issues/`}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-secondary"
                    >
                      <LayoutGrid className="size-3.5" /> Board
                    </Link>
                    <Link
                      href={`/${workspaceSlug}/workspace-views/all-issues/`}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-secondary"
                    >
                      <CalendarDays className="size-3.5" /> Calendar
                    </Link>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen((open) => !open)}
                    className={`hidden h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] sm:flex ${filtersOpen ? "border-accent-strong bg-accent-subtle text-accent-primary" : "border-subtle text-secondary"}`}
                  >
                    <Filter className="size-3.5" /> Filters
                  </button>
                </div>
              </div>

              {filtersOpen && (
                <div className="flex flex-wrap gap-2 border-b border-subtle bg-layer-1/40 px-4 py-2.5">
                  <select
                    value={projectFilter}
                    onChange={(event) => setProjectFilter(event.target.value)}
                    aria-label="Filter by project"
                    className="h-8 rounded-lg border border-subtle bg-surface-1 px-2.5 text-[11px] text-primary"
                  >
                    <option value="all">All Projects</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={priorityFilter}
                    onChange={(event) => setPriorityFilter(event.target.value)}
                    aria-label="Filter by priority"
                    className="h-8 rounded-lg border border-subtle bg-surface-1 px-2.5 text-[11px] text-primary"
                  >
                    <option value="all">All Priorities</option>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                    <option value="none">None</option>
                  </select>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] table-fixed text-left">
                  <thead className="border-b border-subtle text-[10px] font-medium text-tertiary">
                    <tr>
                      <th className="w-[31%] px-5 py-3">Task</th>
                      <th className="w-[22%] px-4 py-3">Project / Context</th>
                      <th className="w-[18%] px-4 py-3">Assignee</th>
                      <th className="w-[13%] px-4 py-3">Due Date</th>
                      <th className="w-[9%] px-4 py-3">Priority</th>
                      <th className="w-[11%] px-4 py-3">Status</th>
                      <th className="w-12 px-2 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-subtle">
                    {pagedTasks.map((task) => {
                      const priority = priorityStyle(task.priority);
                      return (
                        <tr key={task.id} className="hover:bg-layer-1/60">
                          <td className="px-5 py-3">
                            <div className="flex items-start gap-3">
                              <span
                                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${isTaskCompleted(task) ? "border-emerald-500 bg-emerald-500 text-white" : "border-subtle text-transparent"}`}
                              >
                                <Check className="size-3" />
                              </span>
                              <div className="min-w-0">
                                <Link
                                  href={`/${workspaceSlug}/projects/${task.project.id}/issues/${task.id}/`}
                                  className="text-xs block truncate font-semibold text-primary hover:text-accent-primary"
                                >
                                  {task.name}
                                </Link>
                                <p className="mt-1 truncate text-[10px] text-tertiary">
                                  {task.project.identifier}-{task.sequence_id}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="truncate text-[11px] font-medium text-primary">{task.project.name}</p>
                            <span className="bg-blue-50 text-blue-600 mt-1 inline-block rounded-md px-2 py-0.5 text-[9px] font-medium">
                              {task.project.identifier}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {task.assignees.length ? (
                              <div className="flex items-center gap-2">
                                <div className="flex -space-x-1.5">
                                  {task.assignees
                                    .slice(0, 2)
                                    .map(
                                      (assignee) =>
                                        assignee && (
                                          <Avatar
                                            key={assignee.id}
                                            size={24}
                                            name={assignee.display_name}
                                            src={getFileURL(assignee.avatar_url)}
                                          />
                                        )
                                    )}
                                </div>
                                <span className="truncate text-[11px] text-primary">
                                  {task.assignees[0]?.display_name}
                                  {task.assignees.length > 1 ? ` +${task.assignees.length - 1}` : ""}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-tertiary">Unassigned</span>
                            )}
                          </td>
                          <td className={`px-4 py-3 text-[11px] font-medium ${dueTone(task.target_date, today)}`}>
                            {dueLabel(task.target_date, today)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium ${priority.tone}`}
                            >
                              <priority.Icon className="size-3" /> {priority.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block max-w-full truncate rounded-md px-2 py-1 text-[10px] font-medium ${stateStyle(task.stateGroup)}`}
                            >
                              {task.stateName}
                            </span>
                          </td>
                          <td className="px-2 py-3">
                            <Link
                              href={`/${workspaceSlug}/projects/${task.project.id}/issues/${task.id}/`}
                              aria-label={`Open ${task.name}`}
                              className="grid size-7 place-items-center rounded-lg border border-subtle text-tertiary"
                            >
                              <MoreHorizontal className="size-3.5" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {!pagedTasks.length && (
                <div className="grid min-h-52 place-items-center px-4 text-center">
                  <div>
                    <CheckCircle2 className="mx-auto size-7 text-tertiary" />
                    <p className="text-xs mt-2 font-medium text-primary">No tasks in this view</p>
                    <p className="mt-1 text-[11px] text-tertiary">Change the ownership or due-date filter.</p>
                  </div>
                </div>
              )}

              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-subtle px-4 py-3 text-[10px] text-secondary">
                <span>
                  Showing {filteredTasks.length ? (currentPage - 1) * pageSize + 1 : 0} to{" "}
                  {Math.min(currentPage * pageSize, filteredTasks.length)} of {filteredTasks.length} tasks
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    className="grid size-7 place-items-center rounded-lg border border-subtle disabled:opacity-40"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  {Array.from({ length: Math.min(pageCount, 3) }, (_, index) => index + 1).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPage(value)}
                      className={`grid size-7 place-items-center rounded-lg border ${currentPage === value ? "border-accent-primary bg-accent-primary text-white" : "border-subtle"}`}
                    >
                      {value}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={currentPage === pageCount}
                    onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                    className="grid size-7 place-items-center rounded-lg border border-subtle disabled:opacity-40"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
                <label className="flex items-center gap-2">
                  Rows per page:
                  <select
                    value={pageSize}
                    onChange={(event) => setPageSize(Number(event.target.value))}
                    className="h-8 rounded-lg border border-subtle bg-surface-1 px-2 text-[10px] text-primary"
                  >
                    <option value={8}>8</option>
                    <option value={12}>12</option>
                    <option value={24}>24</option>
                  </select>
                </label>
              </footer>
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel
                title="Tasks by Project"
                action={
                  <Link
                    href={`/${workspaceSlug}/summon/projects/`}
                    className="text-[10px] font-medium text-accent-primary"
                  >
                    View all
                  </Link>
                }
              >
                <div className="space-y-3 px-4 pb-4">
                  {byProject.map(
                    ({ project, count }, index) =>
                      project && (
                        <div
                          key={project.id}
                          className="grid grid-cols-[minmax(0,1fr)_auto_minmax(5rem,0.8fr)] items-center gap-3 text-[11px]"
                        >
                          <span className="flex min-w-0 items-center gap-2 font-medium text-primary">
                            <span
                              className={`grid size-7 shrink-0 place-items-center rounded-lg ${["bg-blue-50 text-blue-600", "bg-cyan-50 text-cyan-600", "bg-violet-50 text-violet-600", "bg-amber-50 text-amber-600", "bg-red-50 text-red-600"][index]}`}
                            >
                              <Folder className="size-3.5" />
                            </span>
                            <span className="truncate">{project.name}</span>
                          </span>
                          <span className="text-secondary">{count}</span>
                          <span className="h-1.5 overflow-hidden rounded-full bg-layer-2">
                            <span
                              className="block h-full rounded-full bg-accent-primary"
                              style={{ width: `${(count / maxProjectTasks) * 100}%` }}
                            />
                          </span>
                        </div>
                      )
                  )}
                  {!byProject.length && (
                    <p className="text-xs py-8 text-center text-tertiary">No project tasks in this view.</p>
                  )}
                </div>
              </Panel>

              <Panel
                title="Overdue Tasks"
                action={
                  <button
                    type="button"
                    onClick={() => setDue("overdue")}
                    className="text-[10px] font-medium text-accent-primary"
                  >
                    View all
                  </button>
                }
              >
                <div className="space-y-2 px-4 pb-4">
                  {overdue.map((task) => (
                    <Link
                      key={task.id}
                      href={`/${workspaceSlug}/projects/${task.project.id}/issues/${task.id}/`}
                      className="bg-red-50/70 flex items-center gap-3 rounded-xl px-3 py-2"
                    >
                      <Avatar
                        size={24}
                        name={task.assignees[0]?.display_name ?? "?"}
                        src={getFileURL(task.assignees[0]?.avatar_url ?? "")}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-medium text-primary">{task.name}</span>
                        <span className="block truncate text-[9px] text-secondary">{task.project.name}</span>
                      </span>
                      <span className="text-red-600 shrink-0 text-[10px] font-medium">
                        {dueLabel(task.target_date, today)}
                      </span>
                    </Link>
                  ))}
                  {!overdue.length && <p className="text-xs py-8 text-center text-tertiary">No overdue tasks.</p>}
                </div>
              </Panel>
            </div>
          </main>

          <aside className="min-w-0 space-y-4">
            <Panel title="Task Summary" action={<span className="text-[10px] text-accent-primary">Current view</span>}>
              <div className="grid grid-cols-4 gap-2 px-4 pb-4">
                {[
                  ["Total Tasks", summary.total, CheckCircle2, "text-blue-600"],
                  ["In Progress", summary.inProgress, Clock3, "text-blue-600"],
                  ["To Do", summary.toDo, Circle, "text-secondary"],
                  ["Overdue", summary.overdue, AlertCircle, "text-red-600"],
                ].map(([label, value, Icon, tone]) => {
                  const SummaryIcon = Icon as typeof CheckCircle2;
                  return (
                    <div key={String(label)} className="rounded-xl border border-subtle px-2 py-3 text-center">
                      <SummaryIcon className={`mx-auto size-4 ${tone}`} />
                      <p className="text-base mt-2 font-semibold text-primary">{String(value)}</p>
                      <p className="mt-1 text-[8px] text-tertiary">{String(label)}</p>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel
              title="Upcoming Deadlines"
              action={
                <button
                  type="button"
                  onClick={() => setDue("next7")}
                  className="text-[10px] font-medium text-accent-primary"
                >
                  View all
                </button>
              }
            >
              <div className="space-y-3 px-4 pb-4">
                {upcoming.map((task) => (
                  <Link
                    key={task.id}
                    href={`/${workspaceSlug}/projects/${task.project.id}/issues/${task.id}/`}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2"
                  >
                    <span className="bg-amber-500 mt-1.5 size-1.5 rounded-full" />
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-medium text-primary">{task.name}</span>
                      <span className="block truncate text-[9px] text-tertiary">{task.project.name}</span>
                    </span>
                    <span className={`text-[9px] font-medium ${dueTone(task.target_date, today)}`}>
                      {dueLabel(task.target_date, today)}
                    </span>
                  </Link>
                ))}
                {!upcoming.length && <p className="text-xs py-6 text-center text-tertiary">No upcoming deadlines.</p>}
              </div>
            </Panel>

            <TaskCalendar today={today} tasks={scopedTasks} />

            <Panel
              title="Productivity Insights"
              action={<span className="text-[10px] text-accent-primary">Current data</span>}
            >
              <div className="px-4 pb-4">
                <p className="text-[11px] font-medium text-primary">Based on your accessible Plane work items</p>
                <div className="mt-4 grid grid-cols-2 divide-x divide-subtle">
                  <div className="pr-3">
                    <p className="text-[10px] text-secondary">Tasks Completed</p>
                    <p className="text-xl mt-1 font-semibold text-primary">{summary.completed}</p>
                    <p className="mt-1 text-[9px] text-tertiary">Trend unavailable</p>
                  </div>
                  <div className="pl-3">
                    <p className="text-[10px] text-secondary">On-Time Completion</p>
                    <p className="text-xl mt-1 font-semibold text-primary">
                      {onTimeRate === null ? "—" : `${onTimeRate}%`}
                    </p>
                    <p className="mt-1 text-[9px] text-tertiary">
                      {onTimeRate === null
                        ? "No dated completions"
                        : `${onTimeCount} of ${completedWithDates.length} tasks`}
                    </p>
                  </div>
                </div>
                <p className="mt-4 border-t border-subtle pt-3 text-[9px] text-tertiary">
                  Historical comparison is not available from the current Plane API.
                </p>
              </div>
            </Panel>
          </aside>
        </div>
      )}
    </section>
  );
});

function TaskCalendar(props: { today: string; tasks: Array<{ id: string; target_date: string | null }> }) {
  const [offset, setOffset] = useState(0);
  const calendar = useMemo(() => {
    if (!props.today) return null;
    const base = new Date(`${props.today}T00:00:00`);
    const first = new Date(base.getFullYear(), base.getMonth() + offset, 1);
    const startOffset = (first.getDay() + 6) % 7;
    return {
      title: new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(first),
      days: Array.from({ length: 42 }, (_, index) => {
        const value = new Date(first.getFullYear(), first.getMonth(), index - startOffset + 1);
        const key = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
        return { key, day: value.getDate(), muted: value.getMonth() !== first.getMonth() };
      }),
    };
  }, [offset, props.today]);

  return (
    <Panel
      title="Calendar"
      action={
        calendar && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-secondary">{calendar.title}</span>
            <button type="button" onClick={() => setOffset((value) => value - 1)} aria-label="Previous month">
              <ChevronLeft className="size-3.5" />
            </button>
            <button type="button" onClick={() => setOffset((value) => value + 1)} aria-label="Next month">
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        )
      }
    >
      <div className="px-4 pb-4">
        <div className="grid grid-cols-7 text-center text-[9px] font-medium text-secondary">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <span key={day} className="py-1.5">
              {day}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 text-center text-[10px]">
          {calendar?.days.map((day) => {
            const count = props.tasks.filter((task) => task.target_date === day.key).length;
            return (
              <span
                key={day.key}
                className={`relative grid h-8 place-items-center rounded-lg ${day.key === props.today ? "bg-accent-subtle font-semibold text-accent-primary" : day.muted ? "text-tertiary/50" : "text-primary"}`}
              >
                {day.day}
                {count > 0 && <span className="absolute bottom-1 size-1 rounded-full bg-accent-primary" />}
              </span>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[9px] text-tertiary">
          <span className="size-1.5 rounded-full bg-accent-primary" /> Dates with tasks
        </div>
      </div>
    </Panel>
  );
}
