/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useContext, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router";
import { useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { priority as prioritySchema } from "@summon/convex/task-schema";
import { memberLabel } from "@summon/convex/member-label";
import { NativeTaskCreateContext, type WorkspaceSession } from "@/components/workspace/native-shell/session";
import Link from "next/link";
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
  Plus,
  Search,
} from "lucide-react";
import { Avatar } from "@plane/ui";
import { PageHead } from "@/components/core/page-title";
import { SummonRequestState } from "@/components/summon/request-state";
import { taskStatusOptions } from "@/components/convex-core/tasks/options";
import { TaskMemberAvatar } from "@/components/convex-core/tasks/task-properties";
import { TaskLifecycle, useTaskLifecycle } from "@/components/convex-core/tasks/lifecycle";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import { Select } from "@plane/propel/select";

type CenterArgs = FunctionArgs<typeof api.tasks.center.list>;
type CenterSummary = FunctionReturnType<typeof api.tasks.center.summary>["page"];

const scopeTabs: Array<{ id: CenterArgs["scope"]; label: string }> = [
  { id: "mine", label: "My Tasks" },
  { id: "team", label: "Team Tasks" },
  { id: "created", label: "Assigned by Me" },
  { id: "all", label: "All Tasks" },
];

const dueTabs: Array<{ id: CenterArgs["due"]; label: string }> = [
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

const priorityStyle = (priority: NonNullable<CenterArgs["priority"]>) => {
  if (priority === "urgent" || priority === "high")
    return { label: priority === "urgent" ? "Urgent" : "High", tone: "bg-red-50 text-red-600", Icon: ArrowUp };
  if (priority === "medium") return { label: "Medium", tone: "bg-amber-50 text-amber-600", Icon: ArrowUp };
  if (priority === "low") return { label: "Low", tone: "bg-emerald-50 text-emerald-600", Icon: ArrowDown };
  return { label: "None", tone: "bg-layer-1 text-tertiary", Icon: Circle };
};

const stateStyle = (group: CenterSummary[number]["status"]) => {
  if (group === "done" || group === "cancelled") return "bg-emerald-50 text-emerald-700";
  if (group === "in_progress") return "bg-blue-50 text-blue-700";
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

export function TasksRoot() {
  const session = useOutletContext<WorkspaceSession>();
  const { workspace } = session;
  const workspaceSlug = workspace.slug;
  const commands = useStickiesCommands();
  const projects = useQuery(api.projects.index.list, { workspaceId: workspace._id });
  const [today, setToday] = useState(localDateKey);
  const [scope, setScope] = useState<CenterArgs["scope"]>("mine");
  const [due, setDue] = useState<CenterArgs["due"]>("all");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState<CenterArgs["projectId"] | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<CenterArgs["priority"] | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const createTask = useContext(NativeTaskCreateContext);
  const canCreateTask = createTask !== null;
  const lifecycle = useTaskLifecycle(() => {});
  const {
    results: filteredTasks,
    status: tableStatus,
    loadMore: loadTable,
  } = usePaginatedQuery(
    api.tasks.center.list,
    {
      workspaceId: workspace._id,
      scope,
      due,
      today,
      projectId: projectFilter === "all" ? undefined : projectFilter,
      priority: priorityFilter === "all" ? undefined : priorityFilter,
      search: query,
    },
    { initialNumItems: 100 }
  );
  const {
    results: scopedTasks,
    status: summaryStatus,
    loadMore: loadSummary,
  } = usePaginatedQuery(
    api.tasks.center.summary,
    { workspaceId: workspace._id, scope, today },
    { initialNumItems: 100 }
  );
  useEffect(() => {
    if (tableStatus === "CanLoadMore") loadTable(100);
    if (summaryStatus === "CanLoadMore") loadSummary(100);
  }, [tableStatus, loadTable, summaryStatus, loadSummary]);
  useEffect(() => {
    const refresh = () => setToday(localDateKey());
    const timer = setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const tableReady = tableStatus === "Exhausted";
  const summaryReady = summaryStatus === "Exhausted";
  const ready = tableReady && summaryReady;
  const summary = {
    total: scopedTasks.length,
    inProgress: scopedTasks.filter((task) => !task.due.completed && task.status === "in_progress").length,
    toDo: scopedTasks.filter((task) => !task.due.completed && task.status !== "in_progress").length,
    completed: scopedTasks.filter((task) => task.due.completed).length,
    overdue: scopedTasks.filter((task) => task.due.overdue).length,
  };
  const counts = scopedTasks.reduce(
    (totals, task) => {
      for (const tab of dueTabs) if (task.due[tab.id]) totals[tab.id] += 1;
      return totals;
    },
    { all: 0, today: 0, overdue: 0, week: 0, next7: 0, completed: 0 }
  );
  const pageCount = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedTasks = filteredTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const upcoming = scopedTasks
    .filter((task) => !task.due.completed && task.targetDate && task.targetDate >= today)
    // eslint-disable-next-line unicorn/no-array-sort -- the preceding producer returns a fresh array; target excludes ES2023 toSorted.
    .sort((left, right) => (left.targetDate ?? "").localeCompare(right.targetDate ?? ""))
    .slice(0, 4);
  const overdue = scopedTasks
    .filter((task) => task.due.overdue)
    // eslint-disable-next-line unicorn/no-array-sort -- the preceding producer returns a fresh array; target excludes ES2023 toSorted.
    .sort((left, right) => (left.targetDate ?? "").localeCompare(right.targetDate ?? ""))
    .slice(0, 4);
  const projectGroups = scopedTasks.reduce((groups, task) => {
    const group = groups.get(task.project.id);
    if (group) group.count += 1;
    else groups.set(task.project.id, { project: task.project, count: 1 });
    return groups;
  }, new Map<CenterSummary[number]["project"]["id"], { project: CenterSummary[number]["project"]; count: number }>());
  const byProject = Array.from(projectGroups.values())
    // eslint-disable-next-line unicorn/no-array-sort -- the preceding producer returns a fresh array; target excludes ES2023 toSorted.
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
  const maxProjectTasks = Math.max(...byProject.map(({ count }) => count), 1);
  const completedWithDates = scopedTasks.filter(
    (task) => task.due.completed && task.completedAt !== null && task.targetDate !== null
  );
  const onTimeCount = completedWithDates.filter(
    (task) =>
      task.completedAt !== null &&
      task.targetDate !== null &&
      new Date(task.completedAt).toISOString().slice(0, 10) <= task.targetDate
  ).length;
  const onTimeRate = completedWithDates.length ? Math.round((onTimeCount / completedWithDates.length) * 100) : null;
  const priorities = prioritySchema.members.map((member) => member.value);
  useEffect(() => setPage(1), [due, pageSize, priorityFilter, projectFilter, query, scope]);

  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
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
              onClick={() => createTask?.()}
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
              aria-label="Search tasks or projects"
              maxLength={255}
              className="text-xs h-10 w-full rounded-xl border border-subtle bg-surface-1 pr-3 pl-9 text-primary outline-none focus:border-accent-strong"
            />
          </label>
        )}

        <SummonRequestState loading={!ready} />

        <div
          style={{ display: summaryReady ? undefined : "none" }}
          className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]"
        >
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
                        <span className="rounded-md bg-layer-1 px-1.5 py-0.5 text-[10px]">
                          {summaryReady ? counts[tab.id] : "—"}
                        </span>
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
                  <Select
                    value={projectFilter}
                    onValueChange={(value) => {
                      if (value === "all") setProjectFilter("all");
                      else {
                        const project = projects?.find((item) => item._id === value);
                        if (project) setProjectFilter(project._id);
                      }
                    }}
                    aria-label="Filter by project"
                    placeholder="Selected project unavailable"
                    className="h-8 w-auto min-w-32"
                    options={[
                      { value: "all", label: "All Projects" },
                      ...(projects ?? []).map((project) => ({ value: project._id, label: project.name })),
                    ]}
                  />
                  <Select
                    value={priorityFilter}
                    onValueChange={(value) => {
                      if (value === "all") setPriorityFilter("all");
                      else {
                        const priority = priorities.find((item) => item === value);
                        if (priority) setPriorityFilter(priority);
                      }
                    }}
                    aria-label="Filter by priority"
                    className="h-8 w-auto min-w-32"
                    options={[
                      { value: "all", label: "All Priorities" },
                      ...priorities.map((value) => ({ value, label: priorityStyle(value).label })),
                    ]}
                  />
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
                    {(tableReady ? pagedTasks : []).map(({ task, project, state }) => {
                      const priority = priorityStyle(task.priority);
                      return (
                        <tr key={task._id} className="hover:bg-layer-1/60">
                          <td className="px-5 py-3">
                            <div className="flex items-start gap-3">
                              <span
                                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${task.status === "done" || task.status === "cancelled" ? "border-emerald-500 bg-emerald-500 text-white" : "border-subtle text-transparent"}`}
                              >
                                <Check className="size-3" />
                              </span>
                              <div className="min-w-0">
                                <Link
                                  href={`/${workspaceSlug}/projects/${project.id}/issues/${task._id}/`}
                                  className="text-xs block truncate font-semibold text-primary hover:text-accent-primary"
                                >
                                  {task.title}
                                </Link>
                                <p className="mt-1 truncate text-[10px] text-tertiary">
                                  {project.identifier}-{task.sequence}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="truncate text-[11px] font-medium text-primary">{project.name}</p>
                            <span className="bg-blue-50 text-blue-600 mt-1 inline-block rounded-md px-2 py-0.5 text-[9px] font-medium">
                              {project.identifier}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {task.assignees.length ? (
                              <div className="flex items-center gap-2">
                                <div className="flex -space-x-1.5">
                                  {task.assignees.slice(0, 2).map((assignee) => (
                                    <TaskMemberAvatar key={assignee.id} member={assignee} />
                                  ))}
                                </div>
                                <span className="truncate text-[11px] text-primary">
                                  {memberLabel(task.assignees[0])}
                                  {task.assignees.length > 1 ? ` +${task.assignees.length - 1}` : ""}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-tertiary">Unassigned</span>
                            )}
                          </td>
                          <td className={`px-4 py-3 text-[11px] font-medium ${dueTone(task.targetDate, today)}`}>
                            {dueLabel(task.targetDate, today)}
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
                              className={`inline-block max-w-full truncate rounded-md px-2 py-1 text-[10px] font-medium ${stateStyle(task.status)}`}
                            >
                              {state?.name ?? taskStatusOptions[task.status].label}
                            </span>
                          </td>
                          <td className="px-2 py-3">
                            <TaskLifecycle
                              task={task}
                              disabled={false}
                              lifecycle={lifecycle}
                              href={`/${workspaceSlug}/projects/${project.id}/issues/${task._id}/`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {tableReady && !pagedTasks.length && (
                <div className="grid min-h-52 place-items-center px-4 text-center">
                  <div>
                    <CheckCircle2 className="mx-auto size-7 text-tertiary" />
                    <p className="text-xs mt-2 font-medium text-primary">No tasks in this view</p>
                    <p className="mt-1 text-[11px] text-tertiary">Change the ownership or due-date filter.</p>
                  </div>
                </div>
              )}

              {tableReady && (
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
                  <div className="flex items-center gap-2">
                    Rows per page:
                    <Select
                      aria-label="Rows per page"
                      value={String(pageSize)}
                      onValueChange={(value) => setPageSize(Number(value))}
                      className="h-8 w-20"
                      options={["8", "12", "24"].map((size) => ({ value: size, label: size }))}
                    />
                  </div>
                </footer>
              )}
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
                      key={task.taskId}
                      href={`/${workspaceSlug}/projects/${task.project.id}/issues/${task.taskId}/`}
                      className="bg-red-50/70 flex items-center gap-3 rounded-xl px-3 py-2"
                    >
                      {task.assignee ? <TaskMemberAvatar member={task.assignee} /> : <Avatar size={24} name="?" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-medium text-primary">{task.title}</span>
                        <span className="block truncate text-[9px] text-secondary">{task.project.name}</span>
                      </span>
                      <span className="text-red-600 shrink-0 text-[10px] font-medium">
                        {dueLabel(task.targetDate, today)}
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
                  { label: "Total Tasks", value: summary.total, Icon: CheckCircle2, tone: "text-blue-600" },
                  { label: "In Progress", value: summary.inProgress, Icon: Clock3, tone: "text-blue-600" },
                  { label: "To Do", value: summary.toDo, Icon: Circle, tone: "text-secondary" },
                  { label: "Overdue", value: summary.overdue, Icon: AlertCircle, tone: "text-red-600" },
                ].map(({ label, value, Icon, tone }) => (
                  <div key={label} className="rounded-xl border border-subtle px-2 py-3 text-center">
                    <Icon className={`mx-auto size-4 ${tone}`} />
                    <p className="text-base mt-2 font-semibold text-primary">{value}</p>
                    <p className="mt-1 text-[8px] text-tertiary">{label}</p>
                  </div>
                ))}
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
                    key={task.taskId}
                    href={`/${workspaceSlug}/projects/${task.project.id}/issues/${task.taskId}/`}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2"
                  >
                    <span className="bg-amber-500 mt-1.5 size-1.5 rounded-full" />
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-medium text-primary">{task.title}</span>
                      <span className="block truncate text-[9px] text-tertiary">{task.project.name}</span>
                    </span>
                    <span className={`text-[9px] font-medium ${dueTone(task.targetDate, today)}`}>
                      {dueLabel(task.targetDate, today)}
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
                <p className="text-[11px] font-medium text-primary">Based on your accessible work items</p>
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
                  Historical comparison is not available.
                </p>
              </div>
            </Panel>
          </aside>
        </div>
      </section>
    </PreservedWorkspaceShell>
  );
}

function TaskCalendar(props: { today: string; tasks: CenterSummary }) {
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
            const count = props.tasks.filter((task) => task.targetDate === day.key).length;
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
