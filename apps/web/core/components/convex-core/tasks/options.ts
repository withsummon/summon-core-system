import { STATE_GROUPS } from "@plane/constants";
import type { FunctionArgs } from "convex/server";
import type { api } from "@summon/convex/api";
import type { Doc } from "@summon/convex/data-model";
import { CenterPanelIcon, FullScreenPanelIcon, SidePanelIcon } from "@plane/propel/icons";

export const peekOptions = [
  { key: "side-peek", icon: SidePanelIcon, i18n_title: "common.side_peek" },
  { key: "modal", icon: CenterPanelIcon, i18n_title: "common.modal" },
  { key: "full-screen", icon: FullScreenPanelIcon, i18n_title: "common.full_screen" },
] as const;
export type TaskPeekMode = (typeof peekOptions)[number]["key"];
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

export const stateGroups = {
  backlog: STATE_GROUPS.backlog.key,
  todo: STATE_GROUPS.unstarted.key,
  in_progress: STATE_GROUPS.started.key,
  done: STATE_GROUPS.completed.key,
  cancelled: STATE_GROUPS.cancelled.key,
} satisfies Record<FunctionArgs<typeof api.tasks.index.setStatus>["status"], keyof typeof STATE_GROUPS>;
