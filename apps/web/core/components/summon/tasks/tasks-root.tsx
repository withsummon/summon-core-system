/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  LayoutGrid,
  List,
  ArrowUpRight,
  Filter,
  Calendar,
  Layers,
} from "lucide-react";
import { listAccessiblePlaneIssues } from "@/services/summon-plane.service";
import { useProject } from "@/hooks/store/use-project";
import { SummonRequestState } from "@/components/summon/request-state";

interface ITasksRootProps {
  workspaceSlug: string;
}

type TTaskGroup = "Overdue" | "Today" | "Upcoming" | "Completed";

function getTaskGroup(targetDate: string | undefined | null, completed: boolean): TTaskGroup {
  if (completed) return "Completed";
  const today = new Date().toISOString().slice(0, 10);
  if (!targetDate) return "Upcoming";
  if (targetDate < today) return "Overdue";
  if (targetDate === today) return "Today";
  return "Upcoming";
}

export function TasksRoot({ workspaceSlug }: ITasksRootProps) {
  const { joinedProjectIds, getProjectById } = useProject();

  const {
    data: issues = [],
    error,
    isLoading,
    mutate,
  } = useSWR(["summon-plane-issues", workspaceSlug], () => listAccessiblePlaneIssues(workspaceSlug));

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

  const projectsList = useMemo(
    () =>
      joinedProjectIds.map((id) => ({
        id,
        name: getProjectById(id)?.name || id,
        identifier: getProjectById(id)?.identifier || id,
      })),
    [joinedProjectIds, getProjectById]
  );

  // Filtered issues
  const filteredIssues = useMemo(() => {
    let list = [...issues];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }

    if (selectedProjectId !== "all") {
      list = list.filter((i) => i.project_id === selectedProjectId);
    }

    if (priorityFilter !== "all") {
      list = list.filter((i) => (i.priority || "none").toLowerCase() === priorityFilter);
    }

    return list;
  }, [issues, searchQuery, selectedProjectId, priorityFilter]);

  // Dynamic counts
  const overdueCount = issues.filter((i) => getTaskGroup(i.target_date, false) === "Overdue").length;
  const todayCount = issues.filter((i) => getTaskGroup(i.target_date, false) === "Today").length;
  const upcomingCount = issues.filter((i) => getTaskGroup(i.target_date, false) === "Upcoming").length;
  const totalCount = issues.length;

  const getPriorityBadge = (priority: string | undefined | null) => {
    const p = (priority || "none").toLowerCase();
    if (p === "urgent") {
      return (
        <span className="bg-red-500/10 text-red-600 dark:text-red-400 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold">
          <Flame className="size-3" /> Urgent
        </span>
      );
    }
    if (p === "high") {
      return (
        <span className="bg-orange-500/10 text-orange-600 dark:text-orange-400 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold">
          <AlertTriangle className="size-3" /> High
        </span>
      );
    }
    if (p === "medium") {
      return (
        <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
          Medium
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-layer-2 px-2 py-0.5 text-[10px] font-medium text-tertiary">
        {p === "low" ? "Low" : "Normal"}
      </span>
    );
  };

  const columns: { title: TTaskGroup; color: string; bg: string; icon: React.ReactNode }[] = [
    {
      title: "Overdue",
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-500/10",
      icon: <AlertTriangle className="text-red-500 size-4" />,
    },
    {
      title: "Today",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
      icon: <Clock className="text-amber-500 size-4" />,
    },
    {
      title: "Upcoming",
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10",
      icon: <Calendar className="text-blue-500 size-4" />,
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Task Center</h1>
          <p className="text-xs font-medium text-secondary">
            Cross-project work queues, delivery milestones, and operational commitments
          </p>
        </div>

        <Link
          href={`/${workspaceSlug}/workspace-views/all-issues/`}
          className="text-xs shadow-xs flex items-center gap-1.5 rounded-xl bg-accent-primary px-3.5 py-2 font-bold text-white hover:bg-accent-primary/90"
        >
          <span>Open Full Plane Board</span>
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="shadow-sm flex flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-secondary">Total Work Items</span>
            <div className="bg-indigo-500/10 text-indigo-600 flex size-8 items-center justify-center rounded-xl">
              <Layers className="size-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-primary">{totalCount}</div>
            <div className="mt-1 text-[11px] font-medium text-tertiary">Accessible across projects</div>
          </div>
        </div>

        <div className="shadow-sm flex flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-secondary">Overdue</span>
            <div className="bg-red-500/10 text-red-600 flex size-8 items-center justify-center rounded-xl">
              <AlertTriangle className="size-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl text-red-600 dark:text-red-400 font-bold tracking-tight">{overdueCount}</div>
            <div className="mt-1 text-[11px] font-medium text-tertiary">Past target deadline</div>
          </div>
        </div>

        <div className="shadow-sm flex flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-secondary">Due Today</span>
            <div className="bg-amber-500/10 text-amber-600 flex size-8 items-center justify-center rounded-xl">
              <Clock className="size-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl text-amber-600 dark:text-amber-400 font-bold tracking-tight">{todayCount}</div>
            <div className="mt-1 text-[11px] font-medium text-tertiary">Requires close today</div>
          </div>
        </div>

        <div className="shadow-sm flex flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-secondary">Upcoming</span>
            <div className="bg-blue-500/10 text-blue-600 flex size-8 items-center justify-center rounded-xl">
              <Calendar className="size-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-primary">{upcomingCount}</div>
            <div className="mt-1 text-[11px] font-medium text-tertiary">Future milestones</div>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks by title..."
            className="text-xs placeholder-tertiary shadow-xs focus:border-accent-primary w-full rounded-xl border border-subtle bg-surface-1 py-2 pr-4 pl-9 text-primary focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="text-xs shadow-xs focus:border-accent-primary h-9 cursor-pointer rounded-xl border border-subtle bg-surface-1 px-3 font-medium text-primary focus:outline-none"
          >
            <option value="all">All Projects</option>
            {projectsList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs shadow-xs focus:border-accent-primary h-9 cursor-pointer rounded-xl border border-subtle bg-surface-1 px-3 font-medium text-primary focus:outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <div className="shadow-xs flex items-center rounded-xl border border-subtle bg-surface-1 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`flex size-8 items-center justify-center rounded-lg transition-all ${
                viewMode === "kanban" ? "bg-layer-2 font-bold text-accent-primary" : "text-tertiary hover:text-primary"
              }`}
              title="Kanban Board"
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`flex size-8 items-center justify-center rounded-lg transition-all ${
                viewMode === "list" ? "bg-layer-2 font-bold text-accent-primary" : "text-tertiary hover:text-primary"
              }`}
              title="List View"
            >
              <List className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <SummonRequestState
        loading={isLoading}
        error={error}
        empty={!isLoading && filteredIssues.length === 0}
        emptyMessage="No accessible tasks found matching the criteria."
        onRetry={() => void mutate()}
      />

      {/* Main Kanban / List View */}
      {viewMode === "kanban" ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {columns.map((col) => {
            const colIssues = filteredIssues.filter((i) => getTaskGroup(i.target_date, false) === col.title);

            return (
              <div
                key={col.title}
                className="shadow-sm flex flex-col rounded-2xl border border-subtle bg-surface-1 p-4"
              >
                <div className="flex items-center justify-between border-b border-subtle pb-3">
                  <div className="flex items-center gap-2">
                    <div className={`flex size-7 items-center justify-center rounded-lg ${col.bg}`}>{col.icon}</div>
                    <h3 className="text-xs font-bold text-primary">{col.title}</h3>
                  </div>
                  <span className="rounded-full bg-layer-2 px-2 py-0.5 text-[10px] font-bold text-secondary">
                    {colIssues.length}
                  </span>
                </div>

                <div className="mt-3.5 min-h-[160px] flex-1 space-y-2.5">
                  {colIssues.length > 0 ? (
                    colIssues.map((issue) => {
                      const project = projectsList.find((p) => p.id === issue.project_id);

                      return (
                        <Link
                          key={issue.id}
                          href={`/${workspaceSlug}/projects/${issue.project_id}/issues/${issue.id}/`}
                          className="group hover:border-accent-primary/40 hover:shadow-xs block rounded-xl border border-subtle bg-layer-1 p-3 transition-all hover:bg-layer-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="rounded-md bg-surface-1 px-1.5 py-0.5 text-[9px] font-bold text-accent-primary">
                              {project?.identifier || "ISSUE"}
                            </span>
                            {getPriorityBadge(issue.priority)}
                          </div>

                          <h4 className="text-xs mt-2 line-clamp-2 font-semibold text-primary group-hover:text-accent-primary">
                            {issue.name}
                          </h4>

                          <div className="mt-3 flex items-center justify-between border-t border-subtle/60 pt-2 text-[10px] text-tertiary">
                            <span className="max-w-[130px] truncate">{project?.name || "Plane Project"}</span>
                            <span>{issue.target_date || "No due date"}</span>
                          </div>
                        </Link>
                      );
                    })
                  ) : (
                    <div className="text-xs flex h-32 items-center justify-center text-tertiary">
                      No {col.title.toLowerCase()} tasks
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="shadow-sm overflow-hidden rounded-2xl border border-subtle bg-surface-1">
          <table className="text-xs w-full text-left">
            <thead>
              <tr className="border-b border-subtle bg-layer-1 text-[11px] font-semibold text-tertiary uppercase">
                <th className="px-5 py-3.5">Task Name</th>
                <th className="px-5 py-3.5">Project</th>
                <th className="px-5 py-3.5">Priority</th>
                <th className="px-5 py-3.5">Due Date</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {filteredIssues.map((issue) => {
                const project = projectsList.find((p) => p.id === issue.project_id);

                return (
                  <tr key={issue.id} className="group transition-colors hover:bg-layer-1">
                    <td className="px-5 py-3.5 font-semibold text-primary">
                      <Link
                        href={`/${workspaceSlug}/projects/${issue.project_id}/issues/${issue.id}/`}
                        className="hover:text-accent-primary"
                      >
                        {issue.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-secondary">{project?.name || issue.project_id}</td>
                    <td className="px-5 py-3.5">{getPriorityBadge(issue.priority)}</td>
                    <td className="px-5 py-3.5 text-secondary">{issue.target_date || "No date"}</td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/${workspaceSlug}/projects/${issue.project_id}/issues/${issue.id}/`}
                        className="inline-flex items-center gap-1 font-semibold text-accent-primary hover:underline"
                      >
                        Open <ArrowUpRight className="size-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
