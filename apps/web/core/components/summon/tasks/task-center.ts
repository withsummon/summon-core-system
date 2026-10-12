import type { TIssuePriorities, TStateGroups } from "@plane/types";

export type TTaskCenterScope = "mine" | "team" | "created" | "all";

export type TTaskCenterItem = {
  id: string;
  name: string;
  sequence_id: number;
  project_id: string | null;
  priority: TIssuePriorities | null;
  assignee_ids: string[];
  label_ids: string[];
  created_by: string;
  parent_id: string | null;
  target_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  stateGroup?: TStateGroups | null;
};

/** Each field matches any of its values; fields combine with AND. "none" matches an empty field. */
export type TTaskFilters = {
  status?: TStateGroups[];
  assignee?: string[];
  creator?: string[];
  priority?: TIssuePriorities[];
  label?: string[];
  project?: string[];
  due?: TTaskDueWindow[];
  created?: TTaskPastWindow[];
  updated?: TTaskPastWindow[];
};
export type TTaskFilterField = keyof TTaskFilters;
export type TTaskDueWindow = "overdue" | "today" | "week" | "next7" | "none";
export type TTaskPastWindow = "day" | "week" | "month";

export type TTaskGrouping = "status" | "assignee" | "project" | "priority" | "none";
export type TTaskOrdering = "priority" | "due" | "created" | "updated" | "title";
export type TTaskProperty =
  | "id"
  | "status"
  | "priority"
  | "assignee"
  | "project"
  | "due"
  | "labels"
  | "created"
  | "updated";
export type TTaskDisplay = {
  grouping: TTaskGrouping;
  ordering: TTaskOrdering;
  descending: boolean;
  completedByRecency: boolean;
  completed: "all" | TTaskPastWindow | "none";
  showSubIssues: boolean;
  showEmptyGroups: boolean;
  properties: TTaskProperty[];
};

export const DEFAULT_TASK_DISPLAY: TTaskDisplay = {
  grouping: "status",
  ordering: "priority",
  descending: true,
  completedByRecency: true,
  completed: "all",
  showSubIssues: true,
  showEmptyGroups: false,
  properties: ["id", "priority", "assignee", "project", "due"],
};

export const STATUS_ORDER: TStateGroups[] = ["started", "unstarted", "backlog", "completed", "cancelled"];
export const PRIORITY_ORDER: TIssuePriorities[] = ["urgent", "high", "medium", "low", "none"];
const PAST_WINDOW_DAYS: Record<TTaskPastWindow, number> = { day: 1, week: 7, month: 30 };
const DAY_MS = 86_400_000;

export const isTaskCompleted = (task: Pick<TTaskCenterItem, "completed_at" | "stateGroup">) =>
  Boolean(task.completed_at) || task.stateGroup === "completed" || task.stateGroup === "cancelled";

export const taskStatus = (task: TTaskCenterItem): TStateGroups =>
  task.stateGroup ?? (task.completed_at ? "completed" : "unstarted");

const addDays = (date: string, count: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
};

const withinPast = (timestamp: string | null, window: TTaskPastWindow, now: number) =>
  Boolean(timestamp) && now - new Date(timestamp as string).getTime() <= PAST_WINDOW_DAYS[window] * DAY_MS;

const matchesAny = <T>(selected: T[] | undefined, values: T[]) =>
  !selected?.length || selected.some((value) => values.includes(value));

/**
 * Applies the ownership tab, the filter menu and the display options that hide work (completed window,
 * sub-issues). `today` is the viewer's local YYYY-MM-DD; it is empty until hydration, and date filters
 * then match nothing rather than guess a day.
 */
export function filterTasks<T extends TTaskCenterItem>(
  tasks: T[],
  options: {
    scope: TTaskCenterScope;
    filters: TTaskFilters;
    display: Pick<TTaskDisplay, "completed" | "showSubIssues">;
    currentUserId?: string;
    today: string;
    now: number;
  }
) {
  const { filters, display, today, now } = options;
  const endOfWeek = today ? addDays(today, 7 - (new Date(`${today}T00:00:00Z`).getUTCDay() || 7)) : "";
  const nextSevenDays = today ? addDays(today, 7) : "";
  const dueMatches = (task: T, window: TTaskDueWindow) => {
    if (window === "none") return !task.target_date;
    if (!task.target_date || !today || isTaskCompleted(task)) return false;
    if (window === "overdue") return task.target_date < today;
    if (window === "today") return task.target_date === today;
    if (window === "week") return task.target_date >= today && task.target_date <= endOfWeek;
    return task.target_date >= today && task.target_date <= nextSevenDays;
  };

  return tasks.filter((task) => {
    const me = options.currentUserId;
    const inScope =
      options.scope === "all" ||
      (options.scope === "mine" && Boolean(me && task.assignee_ids.includes(me))) ||
      (options.scope === "team" && task.assignee_ids.length > 0) ||
      (options.scope === "created" && Boolean(me && task.created_by === me));
    if (!inScope) return false;
    if (!display.showSubIssues && task.parent_id) return false;
    if (isTaskCompleted(task) && display.completed !== "all") {
      if (display.completed === "none") return false;
      if (!withinPast(task.completed_at ?? task.updated_at, display.completed, now)) return false;
    }

    return (
      matchesAny(filters.status, [taskStatus(task)]) &&
      matchesAny(filters.assignee, task.assignee_ids.length ? task.assignee_ids : ["none"]) &&
      matchesAny(filters.creator, [task.created_by]) &&
      matchesAny(filters.priority, [task.priority ?? "none"]) &&
      matchesAny(filters.label, task.label_ids.length ? task.label_ids : ["none"]) &&
      matchesAny(filters.project, task.project_id ? [task.project_id] : []) &&
      (!filters.due?.length || filters.due.some((window) => dueMatches(task, window))) &&
      (!filters.created?.length || filters.created.some((window) => withinPast(task.created_at, window, now))) &&
      (!filters.updated?.length || filters.updated.some((window) => withinPast(task.updated_at, window, now)))
    );
  });
}

/** Returns the tasks in display order. Completed work can follow its own recency order, newest first. */
export function sortTasks<T extends TTaskCenterItem>(
  tasks: T[],
  display: Pick<TTaskDisplay, "ordering" | "descending" | "completedByRecency">
) {
  const direction = display.descending ? -1 : 1;
  const compare = (a: T, b: T) => {
    if (display.completedByRecency && isTaskCompleted(a) && isTaskCompleted(b))
      return (b.completed_at ?? b.updated_at).localeCompare(a.completed_at ?? a.updated_at);
    switch (display.ordering) {
      case "priority":
        // Higher priority ranks first when descending.
        return (
          direction * (PRIORITY_ORDER.indexOf(b.priority ?? "none") - PRIORITY_ORDER.indexOf(a.priority ?? "none"))
        );
      case "due":
        // Tasks without a due date always sink to the bottom.
        if (!a.target_date || !b.target_date) return Number(!a.target_date) - Number(!b.target_date);
        return direction * a.target_date.localeCompare(b.target_date);
      case "created":
        return direction * a.created_at.localeCompare(b.created_at);
      case "updated":
        return direction * a.updated_at.localeCompare(b.updated_at);
      case "title":
        return direction * a.name.localeCompare(b.name);
    }
  };
  const sorted = [...tasks];
  sorted.sort((a, b) => compare(a, b) || a.sequence_id - b.sequence_id);
  return sorted;
}

/**
 * Splits tasks into ordered groups. A task with several assignees appears under each of them. Fixed
 * vocabularies (status, priority) and the supplied keys keep their groups when `showEmptyGroups` is set.
 */
export function groupTasks<T extends TTaskCenterItem>(
  tasks: T[],
  display: Pick<TTaskDisplay, "grouping" | "showEmptyGroups">,
  knownKeys: { assignee?: string[]; project?: string[] } = {}
): { key: string; items: T[] }[] {
  const keysOf = (task: T): string[] => {
    switch (display.grouping) {
      case "status":
        return [taskStatus(task)];
      case "priority":
        return [task.priority ?? "none"];
      case "assignee":
        return task.assignee_ids.length ? task.assignee_ids : ["none"];
      case "project":
        return [task.project_id ?? "none"];
      case "none":
        return ["all"];
    }
  };
  const fixedKeys: Record<TTaskGrouping, string[]> = {
    status: STATUS_ORDER,
    priority: PRIORITY_ORDER,
    assignee: knownKeys.assignee ?? [],
    project: knownKeys.project ?? [],
    none: ["all"],
  };
  const groups = new Map<string, T[]>(fixedKeys[display.grouping].map((key) => [key, []]));
  for (const task of tasks) for (const key of keysOf(task)) groups.set(key, [...(groups.get(key) ?? []), task]);
  // Unassigned work trails the people it could belong to.
  if (display.grouping === "assignee" && groups.has("none")) {
    const unassigned = groups.get("none") ?? [];
    groups.delete("none");
    groups.set("none", unassigned);
  }
  return [...groups]
    .map(([key, items]) => ({ key, items }))
    .filter((group) => display.showEmptyGroups || group.items.length > 0);
}

export const countActiveFilters = (filters: TTaskFilters) =>
  Object.values(filters).filter((values) => values?.length).length;
