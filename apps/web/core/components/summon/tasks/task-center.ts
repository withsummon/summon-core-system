import type { TStateGroups } from "@plane/types";

export type TTaskCenterScope = "mine" | "team" | "created" | "all";
export type TTaskCenterDue = "all" | "today" | "overdue" | "week" | "next7" | "completed";

export type TTaskCenterItem = {
  id: string;
  name: string;
  assignee_ids: string[];
  created_by: string;
  target_date: string | null;
  completed_at: string | null;
  stateGroup?: TStateGroups | null;
};

export const isTaskCompleted = (task: TTaskCenterItem) =>
  Boolean(task.completed_at) || task.stateGroup === "completed" || task.stateGroup === "cancelled";

const addDays = (date: string, count: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
};

export function filterTaskCenterItems<T extends TTaskCenterItem>(
  tasks: T[],
  options: { scope: TTaskCenterScope; due: TTaskCenterDue; currentUserId?: string; today: string }
) {
  const todayDate = new Date(`${options.today}T00:00:00Z`);
  const hasToday = Number.isFinite(todayDate.getTime());
  const endOfWeek = hasToday ? addDays(options.today, 7 - (todayDate.getUTCDay() || 7)) : "";
  const nextSevenDays = hasToday ? addDays(options.today, 7) : "";

  return tasks.filter((task) => {
    const matchesScope =
      options.scope === "all" ||
      (options.scope === "mine" &&
        Boolean(options.currentUserId && task.assignee_ids.includes(options.currentUserId))) ||
      (options.scope === "team" && task.assignee_ids.length > 0) ||
      (options.scope === "created" && Boolean(options.currentUserId && task.created_by === options.currentUserId));
    if (!matchesScope) return false;

    const completed = isTaskCompleted(task);
    if (options.due === "completed") return completed;
    if (completed) return options.due === "all";
    if (options.due === "all") return true;
    if (!task.target_date || !hasToday) return false;
    if (options.due === "today") return task.target_date === options.today;
    if (options.due === "overdue") return task.target_date < options.today;
    if (options.due === "week") return task.target_date >= options.today && task.target_date <= endOfWeek;
    return task.target_date >= options.today && task.target_date <= nextSevenDays;
  });
}

export function summarizeTaskCenterItems(tasks: TTaskCenterItem[], today: string) {
  return tasks.reduce(
    (summary, task) => {
      const completed = isTaskCompleted(task);
      summary.total += 1;
      if (completed) summary.completed += 1;
      else if (task.stateGroup === "started") summary.inProgress += 1;
      else summary.toDo += 1;
      if (!completed && task.target_date && task.target_date < today) summary.overdue += 1;
      return summary;
    },
    { total: 0, inProgress: 0, toDo: 0, completed: 0, overdue: 0 }
  );
}
