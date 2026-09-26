import type { Doc } from "@summon/convex/data-model";
export const statusOptions = Object.values({
  backlog: { value: "backlog", label: "Backlog" },
  todo: { value: "todo", label: "To do" },
  in_progress: { value: "in_progress", label: "In progress" },
  done: { value: "done", label: "Done" },
  cancelled: { value: "cancelled", label: "Cancelled" },
} as const satisfies { [Status in Doc<"tasks">["status"]]: { value: Status; label: string } });
