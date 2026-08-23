import assert from "node:assert/strict";
import test from "node:test";

const { filterTaskCenterItems, summarizeTaskCenterItems } = (await import(
  new URL("./task-center.ts", import.meta.url).href
)) as typeof import("./task-center");

const tasks = [
  {
    id: "mine-overdue",
    name: "Overdue work",
    assignee_ids: ["me"],
    created_by: "other",
    target_date: "2026-08-23",
    completed_at: null,
    stateGroup: "started" as const,
  },
  {
    id: "created-today",
    name: "Created work",
    assignee_ids: ["teammate"],
    created_by: "me",
    target_date: "2026-08-24",
    completed_at: null,
    stateGroup: "unstarted" as const,
  },
  {
    id: "done",
    name: "Completed work",
    assignee_ids: ["me"],
    created_by: "me",
    target_date: "2026-08-22",
    completed_at: "2026-08-22T10:00:00Z",
    stateGroup: "completed" as const,
  },
];

test("Task Center combines ownership and due-date filters without counting completed work as overdue", () => {
  assert.deepEqual(
    filterTaskCenterItems(tasks, { scope: "mine", due: "overdue", currentUserId: "me", today: "2026-08-24" }).map(
      ({ id }) => id
    ),
    ["mine-overdue"]
  );
  assert.deepEqual(
    filterTaskCenterItems(tasks, { scope: "created", due: "today", currentUserId: "me", today: "2026-08-24" }).map(
      ({ id }) => id
    ),
    ["created-today"]
  );
});

test("Task Center summary uses canonical Plane state groups", () => {
  assert.deepEqual(summarizeTaskCenterItems(tasks, "2026-08-24"), {
    total: 3,
    inProgress: 1,
    toDo: 1,
    completed: 1,
    overdue: 1,
  });
});
