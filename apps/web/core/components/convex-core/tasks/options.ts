import type { FunctionArgs } from "convex/server";
import type { api } from "@summon/convex/api";
import type { Doc } from "@summon/convex/data-model";
const writableStatusOptions = {
  backlog: { value: "backlog", label: "Backlog" },
  todo: { value: "todo", label: "To do" },
  in_progress: { value: "in_progress", label: "In progress" },
  done: { value: "done", label: "Done" },
  cancelled: { value: "cancelled", label: "Cancelled" },
} as const satisfies {
  [Status in FunctionArgs<typeof api.tasks.index.setStatus>["status"]]: { value: Status; label: string };
};
export const statusOptions = Object.values(writableStatusOptions);
export const taskStatusOptions = {
  ...writableStatusOptions,
  triage: { value: "triage", label: "Triage" },
} as const satisfies { [Status in Doc<"tasks">["status"]]: { value: Status; label: string } };
