import assert from "node:assert/strict";
import test from "node:test";

const { DEFAULT_TASK_DISPLAY, filterTasks, groupTasks, sortTasks } = (await import(
  new URL("./task-center.ts", import.meta.url).href
)) as typeof import("./task-center");

const base = {
  project_id: "alpha",
  priority: "none" as const,
  label_ids: [] as string[],
  parent_id: null,
  completed_at: null,
  created_at: "2026-08-01T09:00:00Z",
  updated_at: "2026-08-01T09:00:00Z",
};
const tasks = [
  {
    ...base,
    id: "mine-overdue",
    name: "Overdue work",
    sequence_id: 1,
    priority: "high" as const,
    assignee_ids: ["me"],
    created_by: "other",
    target_date: "2026-08-23",
    stateGroup: "started" as const,
  },
  {
    ...base,
    id: "created-today",
    name: "Created work",
    sequence_id: 2,
    priority: "urgent" as const,
    assignee_ids: ["teammate", "me"],
    label_ids: ["bug"],
    created_by: "me",
    target_date: "2026-08-24",
    created_at: "2026-08-24T08:00:00Z",
    stateGroup: "unstarted" as const,
  },
  {
    ...base,
    id: "done",
    name: "Completed work",
    sequence_id: 3,
    project_id: "beta",
    assignee_ids: [],
    created_by: "me",
    parent_id: "created-today",
    target_date: null,
    completed_at: "2026-07-01T10:00:00Z",
    stateGroup: "completed" as const,
  },
];
const now = Date.parse("2026-08-24T12:00:00Z");
const ids = (items: { id: string }[]) => items.map(({ id }) => id);
const run = (overrides: Partial<Parameters<typeof filterTasks>[1]> = {}) =>
  ids(
    filterTasks(tasks, {
      scope: "all",
      filters: {},
      display: DEFAULT_TASK_DISPLAY,
      currentUserId: "me",
      today: "2026-08-24",
      now,
      ...overrides,
    })
  );

test("filters combine ownership with each field, treating none as an empty field", () => {
  assert.deepEqual(run({ scope: "mine", filters: { due: ["overdue"] } }), ["mine-overdue"]);
  assert.deepEqual(run({ scope: "created", filters: { due: ["today"] } }), ["created-today"]);
  assert.deepEqual(run({ filters: { assignee: ["none"] } }), ["done"]);
  assert.deepEqual(run({ filters: { label: ["bug"], priority: ["urgent", "high"] } }), ["created-today"]);
  assert.deepEqual(run({ filters: { status: ["started", "completed"], project: ["alpha"] } }), ["mine-overdue"]);
  assert.deepEqual(run({ filters: { created: ["day"] } }), ["created-today"]);
  assert.deepEqual(run({ filters: { due: ["none"] } }), ["done"]);
});

test("display options hide old completed work and sub-issues", () => {
  assert.deepEqual(run({ display: { ...DEFAULT_TASK_DISPLAY, completed: "month" } }), [
    "mine-overdue",
    "created-today",
  ]);
  assert.deepEqual(run({ display: { ...DEFAULT_TASK_DISPLAY, showSubIssues: false } }), [
    "mine-overdue",
    "created-today",
  ]);
});

test("date filters match nothing until the viewer's day is known", () => {
  assert.deepEqual(run({ today: "", filters: { due: ["overdue"] } }), []);
  assert.deepEqual(run({ today: "" }), ["mine-overdue", "created-today", "done"]);
});

test("ordering ranks priority, sinks missing due dates and follows the chosen direction", () => {
  assert.deepEqual(ids(sortTasks(tasks, DEFAULT_TASK_DISPLAY)), ["created-today", "mine-overdue", "done"]);
  assert.deepEqual(ids(sortTasks(tasks, { ...DEFAULT_TASK_DISPLAY, ordering: "due", descending: false })), [
    "mine-overdue",
    "created-today",
    "done",
  ]);
  assert.deepEqual(ids(sortTasks(tasks, { ...DEFAULT_TASK_DISPLAY, ordering: "title", descending: false })), [
    "done",
    "created-today",
    "mine-overdue",
  ]);
});

test("grouping repeats multi-assignee tasks and keeps fixed groups when asked", () => {
  assert.deepEqual(
    groupTasks(tasks, { grouping: "assignee", showEmptyGroups: false }).map(({ key, items }) => [key, ids(items)]),
    [
      ["me", ["mine-overdue", "created-today"]],
      ["teammate", ["created-today"]],
      ["none", ["done"]],
    ]
  );
  assert.deepEqual(
    groupTasks(tasks, { grouping: "status", showEmptyGroups: true }).map(({ key }) => key),
    ["started", "unstarted", "backlog", "completed", "cancelled"]
  );
});
